<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Customer\Models\CustomerProfile;
use App\Modules\Identity\Mail\LoginCodeMail;
use App\Modules\Identity\Models\OwnerLoginChallenge;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;
use Tests\Support\Tenant;

function customerCode(string $email = 'ana@example.test'): string
{
    test()->post(route('customer.auth.code'), ['email' => $email])->assertRedirect(route('customer.auth.login'));

    return Mail::sent(LoginCodeMail::class)->last()->code;
}

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear('otp-request-email:'.hash('sha256', 'ana@example.test'));
    RateLimiter::clear('otp-verify-ip:127.0.0.1');
});

test('sign-in moves to the code step with a truthful resend cooldown and lands in the neutral account', function () {
    $this->withoutVite()->get(route('customer.auth.login'))->assertInertia(fn (Assert $page) => $page
        ->component('customer/auth/login')->where('step', 'email')->where('resendInSeconds', 0));

    $code = customerCode();
    $this->withoutVite()->get(route('customer.auth.login'))->assertInertia(fn (Assert $page) => $page
        ->where('step', 'code')->where('email', 'ana@example.test')->where('resendInSeconds', fn (int $seconds) => $seconds > 0 && $seconds <= 60));

    $this->post(route('customer.auth.verify'), ['code' => $code])->assertRedirect(route('customer.directory'));
    $this->assertAuthenticated();
});

test('a resend inside the cooldown is refused, and after it the newest code wins', function () {
    $first = customerCode();
    $this->post(route('customer.auth.code'), ['email' => 'ana@example.test'])->assertSessionHasErrors('email');
    Mail::assertSent(LoginCodeMail::class, 1);

    $this->travel(61)->seconds();
    $second = customerCode();

    $this->post(route('customer.auth.verify'), ['code' => $first])->assertSessionHasErrors('code');
    $this->post(route('customer.auth.verify'), ['code' => $second])->assertRedirect(route('customer.directory'));
});

test('changing the address through the code request replaces the browser challenge', function () {
    customerCode('ana@example.test');
    $other = customerCode('ana.other@example.test');

    $this->withoutVite()->get(route('customer.auth.login'))->assertInertia(fn (Assert $page) => $page->where('email', 'ana.other@example.test'));
    $this->post(route('customer.auth.verify'), ['code' => $other])->assertRedirect(route('customer.directory'));
    expect(auth()->user()->email)->toBe('ana.other@example.test');
});

test('wrong, replayed and expired codes never sign in', function () {
    $code = customerCode();
    $this->post(route('customer.auth.verify'), ['code' => '000000'])->assertSessionHasErrors('code');
    expect(OwnerLoginChallenge::query()->sole()->failed_attempts)->toBe(1);

    $this->travel(11)->minutes();
    $this->post(route('customer.auth.verify'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('a failed send keeps the email step and does not claim a code was sent', function () {
    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp down'));

    $this->post(route('customer.auth.code'), ['email' => 'ana@example.test'])
        ->assertSessionHasErrors(['email' => 'We could not send the code. Please try again.']);
    $this->withoutVite()->get(route('customer.auth.login'))->assertInertia(fn (Assert $page) => $page->where('step', 'email'));
});

test('logout ends the customer session', function () {
    $this->actingAs(Tenant::user('ana@example.test'))->post(route('customer.logout'))->assertRedirect(route('customer.auth.login'));
    $this->assertGuest();
});

test('the account shell receives the platform profile name and verified state only on account pages', function () {
    $customer = Tenant::user('ana@example.test');
    $customer->forceFill(['email_verified_at' => now()])->save();
    CustomerProfile::query()->create(['user_id' => $customer->id, 'name' => ' Ana Santos ']);

    $this->actingAs($customer)->withoutVite()->get(route('customer.vehicles'))
        ->assertInertia(fn (Assert $page) => $page->where('customer.name', 'Ana Santos')->where('customer.emailVerified', true));
});

test('bookings list only this customer’s online bookings across shops, newest first and paginated', function () {
    $shine = Shop::make('shine');
    $north = Shop::make('northline');
    $customer = Tenant::user('ana@example.test');
    $other = Tenant::user('other@example.test');

    $older = $shine->booking('2026-10-06 10:00', Booking::CONFIRMED, attributes: ['customer_user_id' => $customer->id, 'source' => Booking::SOURCE_ONLINE]);
    $newer = $north->booking('2026-10-08 09:00', Booking::PENDING_APPROVAL, attributes: ['customer_user_id' => $customer->id, 'source' => Booking::SOURCE_ONLINE]);
    // A staff-entered booking with the customer's email is never linked to the account.
    $shine->booking('2026-10-07 10:00', Booking::CONFIRMED, attributes: ['customer_user_id' => null, 'source' => Booking::SOURCE_STAFF, 'contact_email' => 'ana@example.test']);
    $shine->booking('2026-10-07 11:00', Booking::CONFIRMED, attributes: ['customer_user_id' => $other->id, 'source' => Booking::SOURCE_ONLINE, 'contact_email' => 'ana@example.test']);
    $older->forceFill(['operational_state' => Booking::CHECKED_IN, 'checked_in_at' => now()])->save();

    $this->actingAs($customer)->withoutVite()->get(route('customer.bookings'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customer/bookings')
            ->has('bookings', 2)
            ->where('bookings.0.id', $newer->public_id)
            ->where('bookings.0.shop', 'Northline')
            ->where('bookings.0.status', Booking::PENDING_APPROVAL)
            ->where('bookings.0.timezone', 'Asia/Manila')
            ->where('bookings.0.url', "/shops/northline/bookings/{$newer->public_id}")
            ->where('bookings.1.status', Booking::CHECKED_IN)
            ->where('pageInfo.total', 2)
            ->where('pageInfo.lastPage', 1));
});

test('the bookings page is bounded', function () {
    $shop = Shop::make('shine');
    $customer = Tenant::user('ana@example.test');
    foreach (range(0, 20) as $offset) {
        $shop->booking(sprintf('2026-10-%02d 09:00', 6 + $offset), attributes: ['customer_user_id' => $customer->id, 'source' => Booking::SOURCE_ONLINE]);
    }

    $this->actingAs($customer)->withoutVite()->get(route('customer.bookings', ['page' => 2]))
        ->assertInertia(fn (Assert $page) => $page->has('bookings', 1)->where('pageInfo.page', 2)->where('pageInfo.lastPage', 2)->where('pageInfo.total', 21));
});
