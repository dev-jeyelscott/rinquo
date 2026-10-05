<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Mail\LoginCodeMail;
use App\Modules\Identity\Models\OwnerLoginChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear('otp-request-email:'.hash('sha256', 'customer@example.test'));
    RateLimiter::clear('booking-holds');
});

/** Hold and details for a signed-out customer; returns [shop, hold, code]. */
function verifiedDetails(string $email = 'Customer@Example.test'): array
{
    $shop = Shop::make();
    $hold = Journey::hold($shop);
    Journey::saveDetails($shop, $hold, ['email' => $email])->assertSessionHasNoErrors();

    return [$shop, $hold, Mail::sent(LoginCodeMail::class)->last()->code];
}

test('details are saved and a code is emailed with booking wording, then the page moves to the code step', function () {
    [$shop, $hold, $code] = verifiedDetails();

    expect($code)->toMatch('/^\d{6}$/');
    $mail = Mail::sent(LoginCodeMail::class)->last();
    expect($mail->shopName)->toBe('Shine')
        ->and($mail->envelope()->subject)->toBe(config('app.name').' verification code')
        ->and($mail->render())->toContain('booking at Shine');

    $hold->refresh();
    expect($hold->contact_name)->toBe('Ana Cruz')->and($hold->contact_phone)->toBe('+63 912 345 6789')
        ->and($hold->vehicle_plate)->toBe('ABC 123');

    $this->withoutVite()->get(route('bookings.holds.details', ['shine', $hold->public_id]))
        ->assertInertia(fn (Assert $page) => $page->where('verification.step', 'code')->where('verification.email', 'customer@example.test')
            ->where('verification.resendInSeconds', fn ($seconds) => $seconds > 0));

    // The booking flow keeps its own session keys and never touches the Owner sign-in ones.
    expect(session('booking_verification.email'))->toBe('customer@example.test')->and(session('owner_login.email'))->toBeNull();
});

test('an Owner sign-in code keeps its sign-in wording', function () {
    $this->post(route('owner.auth.code'), ['email' => 'owner@example.test']);

    $mail = Mail::sent(LoginCodeMail::class)->last();
    expect($mail->shopName)->toBeNull()
        ->and($mail->envelope()->subject)->toBe(config('app.name').' sign-in code')
        ->and($mail->render())->toContain('sign-in code is');
});

test('the code is stored only as a hash', function () {
    [, , $code] = verifiedDetails();

    $challenge = OwnerLoginChallenge::query()->sole();
    expect(json_encode($challenge->getAttributes()))->not->toContain($code);
});

test('a valid code signs the customer in, regenerates the session and keeps the hold', function () {
    [$shop, $hold, $code] = verifiedDetails();
    $before = session()->getId();

    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code])
        ->assertRedirect(route('bookings.holds.confirm.show', ['shine', $hold->public_id]));

    $user = User::query()->where('email', 'customer@example.test')->sole();
    expect(auth()->id())->toBe($user->id)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(session()->getId())->not->toBe($before)
        ->and(session('booking_verification.token'))->toBeNull();

    // The hold token survived regeneration: the confirm page still opens.
    $this->withoutVite()->get(route('bookings.holds.confirm.show', ['shine', $hold->public_id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('shops/book/confirm')->where('customerEmail', 'customer@example.test'));
});

test('a verified email that belongs to an existing user links that user', function () {
    $existing = Tenant::user('customer@example.test');
    [$shop, $hold, $code] = verifiedDetails();

    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code]);

    expect(auth()->id())->toBe($existing->id)->and(User::query()->where('email', 'customer@example.test')->count())->toBe(1);
});

test('without verification no account is created, selected or linked', function () {
    $existing = Tenant::user('customer@example.test');
    $shop = Shop::make();
    $hold = Journey::hold($shop);
    Journey::saveDetails($shop, $hold, ['email' => 'customer@example.test']);

    expect(auth()->check())->toBeFalse();

    // Typing an email never authenticates, and confirming signed out books nothing.
    Journey::confirm($shop, $hold)->assertRedirect(route('bookings.holds.details', ['shine', $hold->public_id]));
    $this->withoutVite()->get(route('bookings.holds.confirm.show', ['shine', $hold->public_id]))
        ->assertRedirect(route('bookings.holds.details', ['shine', $hold->public_id]));

    expect(Booking::query()->count())->toBe(0)
        ->and(User::query()->where('email', 'customer@example.test')->count())->toBe(1)
        ->and($existing->fresh()->email_verified_at)->toBeNull();
});

test('a wrong code is rejected and a consumed code cannot be reused', function () {
    [$shop, $hold, $code] = verifiedDetails();

    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code === '000000' ? '111111' : '000000'])
        ->assertSessionHasErrors('code');
    expect(auth()->check())->toBeFalse();

    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code])->assertSessionHasNoErrors();
    auth()->logout();

    // The challenge was consumed; a replay with a fresh session has no token at all.
    $this->flushSession();
    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code])->assertNotFound();
});

test('too many wrong guesses burn the challenge', function () {
    [$shop, $hold, $code] = verifiedDetails();
    $wrong = $code === '000000' ? '111111' : '000000';

    foreach (range(1, 5) as $ignored) {
        $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $wrong]);
    }
    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => $code])->assertSessionHasErrors('code');

    expect(auth()->check())->toBeFalse();
});

test('a malformed code is a validation error', function () {
    [$shop, $hold] = verifiedDetails();

    $this->post(route('bookings.holds.verify', ['shine', $hold->public_id]), ['code' => 'abc'])->assertSessionHasErrors('code');
});

test('requesting a code is throttled per email and respects the resend cooldown', function () {
    [$shop, $hold] = verifiedDetails();

    // Resending inside the cooldown is refused with a wait message.
    $this->post(route('bookings.holds.code', ['shine', $hold->public_id]))->assertSessionHasErrors('email');
    expect(Mail::sent(LoginCodeMail::class)->count())->toBe(1);

    $this->travel(61)->seconds();
    $this->post(route('bookings.holds.code', ['shine', $hold->public_id]))->assertSessionHasNoErrors();
    expect(Mail::sent(LoginCodeMail::class)->count())->toBe(2);
});

test('editing details while a code for the same email is pending does not spend the cooldown', function () {
    [$shop, $hold] = verifiedDetails();

    Journey::saveDetails($shop, $hold, ['email' => 'customer@example.test', 'contact_name' => 'Ana Maria Cruz'])->assertSessionHasNoErrors();

    expect(Mail::sent(LoginCodeMail::class)->count())->toBe(1)
        ->and($hold->fresh()->contact_name)->toBe('Ana Maria Cruz');
});

test('restarting clears the pending verification', function () {
    [$shop, $hold] = verifiedDetails();

    $this->post(route('bookings.holds.restart', ['shine', $hold->public_id]))->assertRedirect();

    $this->withoutVite()->get(route('bookings.holds.details', ['shine', $hold->public_id]))
        ->assertInertia(fn (Assert $page) => $page->where('verification.step', 'details'));
});

test('a signed-in customer skips the code step and may not type another email', function () {
    $customer = Tenant::user('known@example.test');
    $shop = Shop::make();
    $this->actingAs($customer);
    $hold = Journey::hold($shop);

    Journey::saveDetails($shop, $hold, ['email' => 'someone-else@example.test'])->assertSessionHasErrors('email');
    Journey::saveDetails($shop, $hold)->assertRedirect(route('bookings.holds.confirm.show', ['shine', $hold->public_id]));

    expect(Mail::sent(LoginCodeMail::class)->count())->toBe(0);
});

test('details are validated', function () {
    $shop = Shop::make();
    $hold = Journey::hold($shop);

    Journey::saveDetails($shop, $hold, ['contact_name' => '', 'email' => 'a@example.test'])->assertSessionHasErrors('contact_name');
    Journey::saveDetails($shop, $hold, ['contact_name' => str_repeat('a', 121), 'email' => 'a@example.test'])->assertSessionHasErrors('contact_name');
    Journey::saveDetails($shop, $hold, ['contact_phone' => 'call me', 'email' => 'a@example.test'])->assertSessionHasErrors('contact_phone');
    Journey::saveDetails($shop, $hold, ['vehicle_plate' => str_repeat('a', 21), 'email' => 'a@example.test'])->assertSessionHasErrors('vehicle_plate');
    Journey::saveDetails($shop, $hold, ['customer_notes' => str_repeat('a', 501), 'email' => 'a@example.test'])->assertSessionHasErrors('customer_notes');
    Journey::saveDetails($shop, $hold, ['email' => 'not-an-email'])->assertSessionHasErrors('email');
    Journey::saveDetails($shop, $hold, ['email' => null])->assertSessionHasErrors('email');

    expect($hold->fresh()->contact_name)->toBeNull();
});

test('details cannot be saved on a released or converted hold', function () {
    $shop = Shop::make();
    $first = Journey::hold($shop, '2026-10-06 10:00');
    Journey::hold($shop, '2026-10-06 12:00'); // releases the first

    expect($first->fresh()->status)->toBe(Hold::RELEASED);
    Journey::saveDetails($shop, $first, ['email' => 'a@example.test'])->assertRedirect(route('bookings.wizard', 'shine'));
    expect($first->fresh()->contact_name)->toBeNull();
});

test('the booking code email warns that it signs in to the account and must not be shared', function () {
    $html = (new LoginCodeMail('123456', 10, 'Shine'))->render();

    expect($html)->toContain('signs you in to your')
        ->toContain('Never share it')
        ->toContain('including the shop')
        ->toContain('If you did not request it, ignore this email.');
});
