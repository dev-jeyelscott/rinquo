<?php

use App\Modules\Identity\Mail\LoginCodeMail;
use App\Modules\Identity\Models\OwnerLoginChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;

function requestCode(string $email = 'Owner@Example.test'): string
{
    test()->withoutVite()->post(route('owner.auth.code'), ['email' => $email])->assertRedirect(route('owner.auth.login'));

    return Mail::sent(LoginCodeMail::class)->last()->code;
}

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear('otp-request-email:'.hash('sha256', 'owner@example.test'));
});

test('the login page starts at the email step', function () {
    $this->withoutVite()->get(route('owner.auth.login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('owner/auth/login')->where('step', 'email'));
});

test('a code is emailed, stored only as a hash, and the page moves to the code step', function () {
    $code = requestCode();

    expect($code)->toMatch('/^\d{6}$/');
    $challenge = OwnerLoginChallenge::query()->sole();
    expect($challenge->email)->toBe('owner@example.test')
        ->and($challenge->code_hash)->not->toContain($code)
        ->and($challenge->token_hash)->toHaveLength(64)
        ->and(json_encode($challenge->getAttributes()))->not->toContain($code);

    $this->withoutVite()->get(route('owner.auth.login'))
        ->assertInertia(fn (Assert $page) => $page->where('step', 'code')->where('email', 'owner@example.test')->where('resendInSeconds', fn ($s) => $s > 0));
});

test('the code mail is sent synchronously and is not a queued job', function () {
    requestCode();

    Mail::assertSent(LoginCodeMail::class, 1);
    Mail::assertNotQueued(LoginCodeMail::class);
});

test('a valid code signs the owner in with a regenerated session and one user per email', function () {
    $code = requestCode();
    $before = session()->getId();

    $this->post(route('owner.auth.verify'), ['code' => $code])->assertRedirect(route('owner.home'));

    $this->assertAuthenticated();
    expect(User::query()->count())->toBe(1)
        ->and(User::query()->sole()->email)->toBe('owner@example.test')
        ->and(User::query()->sole()->email_verified_at)->not->toBeNull()
        ->and(session()->getId())->not->toBe($before)
        ->and(OwnerLoginChallenge::query()->sole()->consumed_at)->not->toBeNull();
});

test('the same email on a later sign-in reuses the user', function () {
    $code = requestCode();
    $this->post(route('owner.auth.verify'), ['code' => $code]);
    $this->post(route('owner.auth.logout'))->assertRedirect(route('owner.auth.login'));
    $this->assertGuest();

    $this->travel(2)->minutes();
    $code = requestCode('OWNER@example.test');
    $this->post(route('owner.auth.verify'), ['code' => $code])->assertRedirect(route('owner.home'));

    expect(User::query()->count())->toBe(1);
});

test('a code cannot be replayed once consumed', function () {
    $code = requestCode();
    $this->post(route('owner.auth.verify'), ['code' => $code]);
    $this->post(route('owner.auth.logout'));

    $this->post(route('owner.auth.verify'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('a wrong code is rejected generically and never authenticates', function () {
    requestCode();

    $this->post(route('owner.auth.verify'), ['code' => '000000'])->assertSessionHasErrors('code');
    $this->assertGuest();
    expect(OwnerLoginChallenge::query()->sole()->failed_attempts)->toBe(1);
});

test('an expired code is rejected', function () {
    $code = requestCode();
    $this->travel(11)->minutes();

    $this->post(route('owner.auth.verify'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('too many wrong guesses invalidate the challenge even for the right code', function () {
    $code = requestCode();
    $wrong = $code === '111111' ? '222222' : '111111';

    foreach (range(1, 5) as $ignored) {
        $this->post(route('owner.auth.verify'), ['code' => $wrong])->assertSessionHasErrors('code');
    }
    $this->post(route('owner.auth.verify'), ['code' => $code])->assertSessionHasErrors('code');

    $this->assertGuest();
});

test('verification without a challenge in the session fails', function () {
    $this->post(route('owner.auth.verify'), ['code' => '123456'])->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('the code must be six digits', function () {
    requestCode();

    $this->post(route('owner.auth.verify'), ['code' => 'abc'])->assertSessionHasErrors('code');
});

test('a resend inside the cooldown is refused and after it succeeds with the newest challenge winning', function () {
    $first = requestCode();

    $this->post(route('owner.auth.code'), ['email' => 'owner@example.test'])->assertSessionHasErrors('email');
    Mail::assertSent(LoginCodeMail::class, 1);

    $this->travel(61)->seconds();
    $second = requestCode();

    $this->post(route('owner.auth.verify'), ['code' => $first])->assertSessionHasErrors('code');
    $this->post(route('owner.auth.verify'), ['code' => $second])->assertRedirect(route('owner.home'));
});

test('requests are throttled per email', function () {
    foreach (range(1, 5) as $ignored) {
        $this->travel(61)->seconds();
        requestCode();
    }

    $this->travel(61)->seconds();
    $this->post(route('owner.auth.code'), ['email' => 'owner@example.test'])->assertSessionHasErrors('email');
    Mail::assertSent(LoginCodeMail::class, 5);
});

test('requests are throttled per IP across different emails', function () {
    config(['rinquo.otp.request_per_ip_per_hour' => 2]);
    RateLimiter::clear('otp-request-ip:127.0.0.1');

    $this->post(route('owner.auth.code'), ['email' => 'a@example.test']);
    $this->post(route('owner.auth.code'), ['email' => 'b@example.test']);
    $this->post(route('owner.auth.code'), ['email' => 'c@example.test'])->assertSessionHasErrors('email');
    RateLimiter::clear('otp-request-ip:127.0.0.1');
});

test('a mail provider failure invalidates the challenge and returns a generic retryable error', function () {
    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp down: secret-detail'));

    $this->post(route('owner.auth.code'), ['email' => 'owner@example.test'])
        ->assertSessionHasErrors(['email' => 'We could not send the code. Please try again.']);

    expect(OwnerLoginChallenge::query()->sole()->consumed_at)->not->toBeNull();
    $this->withoutVite()->get(route('owner.auth.login'))->assertInertia(fn (Assert $page) => $page->where('step', 'email'));
});

test('the email must be valid', function () {
    $this->post(route('owner.auth.code'), ['email' => 'not-an-email'])->assertSessionHasErrors('email');
    expect(OwnerLoginChallenge::query()->count())->toBe(0);
});

test('the raw code is never written to the database or the log', function () {
    Mail::fake();
    $code = requestCode();

    expect(json_encode(OwnerLoginChallenge::query()->get()->makeVisible(['token_hash', 'code_hash'])->toArray()))->not->toContain($code);
});

test('signed-in owners are redirected away from the login page and guests from owner pages', function () {
    $this->get(route('owner.home'))->assertRedirect(route('owner.auth.login'));

    $this->actingAs(User::query()->create(['email' => 'x@example.test']))
        ->get(route('owner.auth.login'))->assertRedirect(route('owner.home'));
});

test('logout invalidates the session', function () {
    $code = requestCode();
    $this->post(route('owner.auth.verify'), ['code' => $code]);

    $this->post(route('owner.auth.logout'))->assertRedirect(route('owner.auth.login'));

    $this->assertGuest();
    $this->get(route('owner.home'))->assertRedirect(route('owner.auth.login'));
});
