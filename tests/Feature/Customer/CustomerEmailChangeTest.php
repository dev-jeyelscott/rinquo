<?php

use App\Modules\Customer\Mail\CustomerEmailChangedMail;
use App\Modules\Customer\Models\CustomerEmailChangeChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

/** Requests a change to $email and pins the emailed code to $code for the test. */
function requestEmailChange(string $email = 'ana.new@example.test', string $code = '123456'): CustomerEmailChangeChallenge
{
    test()->post(route('customer.profile.email-change.request'), ['email' => $email])->assertSessionHasNoErrors();
    $challenge = CustomerEmailChangeChallenge::query()->latest('id')->firstOrFail();
    $challenge->forceFill(['code_hash' => hash_hmac('sha256', $challenge->new_email.'|'.$code, (string) config('app.key'))])->save();

    return $challenge;
}

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear('customer-email-change-verify-ip:127.0.0.1');
    $this->customer = Tenant::user('ana@example.test');
    $this->customer->forceFill(['email_verified_at' => now()])->save();
    $this->actingAs($this->customer)->withoutVite();
});

test('a requested change is pending on the profile while the current email stays active', function () {
    requestEmailChange('Ana.New@Example.test');

    $this->get(route('customer.profile'))->assertInertia(fn (Assert $page) => $page
        ->component('customer/profile')
        ->where('profile.email', 'ana@example.test')
        ->where('emailChange.pendingEmail', 'ana.new@example.test')
        ->where('emailChange.changedTo', null));
    expect($this->customer->fresh()->email)->toBe('ana@example.test');
});

test('a verified code changes the email once, reports it on the profile and notifies the old address', function () {
    requestEmailChange();

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertRedirect(route('customer.profile'));

    expect($this->customer->fresh()->email)->toBe('ana.new@example.test');
    Mail::assertSent(CustomerEmailChangedMail::class, fn (CustomerEmailChangedMail $mail) => $mail->hasTo('ana@example.test') && $mail->newEmail === 'ana.new@example.test');
    $this->get(route('customer.profile'))->assertInertia(fn (Assert $page) => $page
        ->where('emailChange.changedTo', 'ana.new@example.test')
        ->where('emailChange.pendingEmail', null));
    $this->get(route('customer.profile'))->assertInertia(fn (Assert $page) => $page->where('emailChange.changedTo', null));

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertSessionHasErrors('code');
});

test('wrong guesses are counted durably and exhaust the challenge even for the right code', function () {
    config(['rinquo.otp.max_failed_attempts' => 3]);
    $challenge = requestEmailChange();

    foreach (range(1, 3) as $attempt) {
        $this->post(route('customer.profile.email-change.verify'), ['code' => '000000'])->assertSessionHasErrors('code');
        expect($challenge->fresh()->failed_attempts)->toBe($attempt);
    }

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertSessionHasErrors('code');
    expect($this->customer->fresh()->email)->toBe('ana@example.test')
        ->and($challenge->fresh()->consumed_at)->not->toBeNull();
});

test('an expired code is rejected without changing the email', function () {
    requestEmailChange();
    $this->travel(11)->minutes();

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])
        ->assertSessionHasErrors(['code' => 'That code is invalid or has expired. Request a new code.']);
    expect($this->customer->fresh()->email)->toBe('ana@example.test');
});

test('a new code request replaces the pending challenge and the earlier code stops working', function () {
    requestEmailChange('ana.new@example.test', '111111');
    requestEmailChange('ana.new@example.test', '222222');

    $this->post(route('customer.profile.email-change.verify'), ['code' => '111111'])->assertSessionHasErrors('code');
    $this->post(route('customer.profile.email-change.verify'), ['code' => '222222'])->assertSessionHasNoErrors();
    expect($this->customer->fresh()->email)->toBe('ana.new@example.test');
});

test('a failed send keeps the previous pending challenge and never claims a new code', function () {
    requestEmailChange('first@example.test');
    Mail::shouldReceive('raw')->andThrow(new RuntimeException('smtp down'));

    $this->post(route('customer.profile.email-change.request'), ['email' => 'second@example.test'])
        ->assertSessionHasErrors(['email' => 'We could not send the code. Please try again.']);

    $this->get(route('customer.profile'))->assertInertia(fn (Assert $page) => $page->where('emailChange.pendingEmail', 'first@example.test'));
});

test('an address claimed by another account before verification is refused and nothing changes', function () {
    requestEmailChange('taken@example.test');
    Tenant::user('taken@example.test');

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])
        ->assertSessionHasErrors(['code' => 'That email address is already in use.']);
    expect($this->customer->fresh()->email)->toBe('ana@example.test');
});

test('a mail failure to the old address cannot undo a verified change', function () {
    requestEmailChange();
    Mail::shouldReceive('to')->with('ana@example.test')->andThrow(new RuntimeException('smtp down'));

    $this->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertSessionHasNoErrors();
    expect($this->customer->fresh()->email)->toBe('ana.new@example.test');
});

test('a code cannot be verified without this browser’s challenge or against another account', function () {
    $challenge = requestEmailChange();
    $other = Tenant::user('other@example.test');

    $this->actingAs($other)->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertSessionHasErrors('code');
    expect($other->fresh()->email)->toBe('other@example.test')
        ->and($challenge->fresh()->consumed_at)->toBeNull();

    $this->flushSession();
    $this->actingAs($this->customer)->post(route('customer.profile.email-change.verify'), ['code' => '123456'])->assertSessionHasErrors('code');
    expect(User::query()->where('email', 'ana.new@example.test')->exists())->toBeFalse();
});
