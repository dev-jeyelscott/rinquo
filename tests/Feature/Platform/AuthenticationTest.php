<?php

use App\Modules\Identity\Models\User;
use App\Modules\Platform\Auth\RecoveryCodes;
use App\Modules\Platform\Mail\SecurityNoticeMail;
use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Platform;

beforeEach(function () {
    Mail::fake();
    $this->withoutVite();
    RateLimiter::clear('platform-login:'.hash('sha256', 'admin@example.test').'|127.0.0.1');
});

function signInPassword(string $email = 'admin@example.test', string $password = Platform::PASSWORD)
{
    return test()->post(route('platform.login.attempt'), ['email' => $email, 'password' => $password]);
}

test('there is no public registration route', function () {
    $this->get('/platform/register')->assertNotFound();
    $this->post('/platform/register')->assertNotFound();
});

test('guests and tenant users cannot open the platform surface', function () {
    $this->get(route('platform.overview'))->assertRedirect(route('platform.login'));

    $owner = User::query()->create(['email' => 'owner@example.test']);
    $this->actingAs($owner)->get(route('platform.overview'))->assertRedirect(route('platform.login'));
    $this->actingAs($owner)->get(route('platform.admins'))->assertRedirect(route('platform.login'));
});

test('a platform admin session does not open tenant routes', function () {
    $admin = Platform::admin();
    signInPassword();
    $this->post(route('platform.mfa.verify'), ['code' => Platform::code($admin)])->assertRedirect(route('platform.overview'));

    // A tenant request resolves the default (tenant) guard, which this identity never satisfies.
    Auth::shouldUse('web');
    $this->get(route('owner.home'))->assertRedirect(route('owner.auth.login'));
});

test('a correct password alone never creates an authorized session', function () {
    Platform::admin();

    signInPassword()->assertRedirect(route('platform.mfa'));

    $this->get(route('platform.overview'))->assertRedirect(route('platform.login'));
    $this->assertGuest('platform');
});

test('the password and then an authenticator code complete sign-in with a regenerated session', function () {
    $admin = Platform::admin();
    signInPassword();
    $before = session()->getId();

    $this->post(route('platform.mfa.verify'), ['code' => Platform::code($admin)])->assertRedirect(route('platform.overview'));

    $this->assertAuthenticatedAs($admin->fresh(), 'platform');
    expect(session()->getId())->not->toBe($before);
    $this->get(route('platform.overview'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/overview'));
    expect(AuditEvent::query()->where('event', 'login.factor')->where('result', 'success')->exists())->toBeTrue();
});

test('failures are generic and do not reveal whether an address is an administrator', function () {
    Platform::admin();

    $wrong = signInPassword(password: 'wrong-password-wrong')->assertSessionHasErrors('email');
    $unknown = signInPassword('nobody@example.test')->assertSessionHasErrors('email');

    expect(session('errors')->first('email'))->toBe('These credentials were not accepted.');
    $this->assertGuest('platform');
});

test('a disabled admin cannot sign in', function () {
    $admin = Platform::admin();
    $admin->forceFill(['status' => PlatformAdmin::DISABLED])->save();

    signInPassword()->assertSessionHasErrors('email');
    $this->assertGuest('platform');
});

test('sign-in attempts are throttled per address and ip', function () {
    Platform::admin();

    foreach (range(1, 5) as $_) {
        signInPassword(password: 'wrong-password-wrong');
    }
    signInPassword()->assertSessionHasErrors('email');
    expect(session('errors')->first('email'))->toContain('Too many');
});

test('a wrong or replayed authenticator code is rejected', function () {
    $admin = Platform::admin();
    signInPassword();
    $this->post(route('platform.mfa.verify'), ['code' => '000000'])->assertSessionHasErrors('code');
    $this->assertGuest('platform');

    $code = Platform::code($admin);
    $this->post(route('platform.mfa.verify'), ['code' => $code])->assertRedirect(route('platform.overview'));
    $this->post(route('platform.logout'));

    // The same time step cannot be used a second time.
    signInPassword();
    $this->post(route('platform.mfa.verify'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest('platform');
});

test('the password step expires', function () {
    $admin = Platform::admin();
    signInPassword();

    $this->travel(11)->minutes();

    $this->post(route('platform.mfa.verify'), ['code' => Platform::code($admin)])->assertRedirect(route('platform.login'));
    $this->assertGuest('platform');
});

test('a new admin enrolls an authenticator, is signed in, and sees recovery codes exactly once', function () {
    $admin = Platform::admin(factor: false);
    signInPassword()->assertRedirect(route('platform.enroll'));

    $this->get(route('platform.enroll'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/auth/enroll')->has('secret')->has('otpauthUri'));
    $admin->refresh();
    $code = Platform::code($admin);

    $this->post(route('platform.enroll.confirm'), ['code' => $code])->assertRedirect(route('platform.recovery-codes'));
    $this->assertAuthenticatedAs($admin->fresh(), 'platform');
    $this->get(route('platform.recovery-codes'))->assertInertia(fn (Assert $page) => $page->component('platform/auth/recovery-codes')->has('codes', 10));
    $this->get(route('platform.recovery-codes'))->assertRedirect(route('platform.overview'));

    expect($admin->fresh()->hasConfirmedFactor())->toBeTrue()
        ->and($admin->recoveryCodes()->count())->toBe(10);
});

test('recovery codes are stored hashed, work once, and trigger a security notice', function () {
    $admin = Platform::admin();
    $codes = app(RecoveryCodes::class)->regenerate($admin);

    foreach ($codes as $plain) {
        expect($admin->recoveryCodes()->pluck('code_digest')->all())->not->toContain($plain);
    }

    signInPassword();
    $this->post(route('platform.mfa.verify'), ['recovery_code' => strtoupper($codes[0])])->assertRedirect(route('platform.overview'));
    Mail::assertSent(SecurityNoticeMail::class);

    $this->post(route('platform.logout'));
    signInPassword();
    $this->post(route('platform.mfa.verify'), ['recovery_code' => $codes[0]])->assertSessionHasErrors('recovery_code');
    $this->assertGuest('platform');
});

test('recovery code attempts are throttled', function () {
    $admin = Platform::admin();
    signInPassword();

    foreach (range(1, 5) as $_) {
        $this->post(route('platform.mfa.verify'), ['recovery_code' => 'aaaaa-aaaaa'])->assertSessionHasErrors();
    }
    $this->post(route('platform.mfa.verify'), ['code' => Platform::code($admin)])->assertSessionHasErrors('code');
    $this->assertGuest('platform');
});

test('a session ends after 30 minutes of inactivity and after 12 hours absolute', function () {
    $admin = Platform::admin();
    $now = CarbonImmutable::now()->getTimestamp();

    $this->actingAs($admin, 'platform')->withSession(Platform::session($admin, ['platform.last_activity' => $now - 31 * 60]))
        ->get(route('platform.overview'))->assertRedirect(route('platform.login'));
    $this->assertGuest('platform');

    $this->actingAs($admin, 'platform')->withSession(Platform::session($admin, ['platform.started_at' => $now - 12 * 3600 - 60]))
        ->get(route('platform.overview'))->assertRedirect(route('platform.login'));
    $this->assertGuest('platform');
});

test('a stale session generation or disabled admin is rejected on the next request', function () {
    $admin = Platform::admin();
    $session = Platform::session($admin);

    $admin->forceFill(['session_generation' => 2])->save();
    $this->actingAs($admin, 'platform')->withSession($session)->get(route('platform.overview'))->assertRedirect(route('platform.login'));

    $fresh = Platform::admin('other@example.test');
    $session = Platform::session($fresh);
    $fresh->forceFill(['status' => PlatformAdmin::DISABLED])->save();
    $this->actingAs($fresh, 'platform')->withSession($session)->get(route('platform.overview'))->assertRedirect(route('platform.login'));
});

test('email reset changes the password only: it creates no session and does not touch the factor', function () {
    $admin = Platform::admin();
    $secret = $admin->totp_secret;
    $token = app('auth.password')->broker('platform_admins')->createToken($admin);

    $this->post(route('platform.password.update'), [
        'token' => $token, 'email' => 'admin@example.test', 'password' => 'a-brand-new-passphrase', 'password_confirmation' => 'a-brand-new-passphrase',
    ])->assertRedirect(route('platform.login'));

    $this->assertGuest('platform');
    $fresh = $admin->fresh();
    expect($fresh->totp_secret)->toBe($secret)
        ->and($fresh->session_generation)->toBe(2);

    // The new password still needs the second factor.
    signInPassword(password: 'a-brand-new-passphrase')->assertRedirect(route('platform.mfa'));
    $this->get(route('platform.overview'))->assertRedirect(route('platform.login'));
});

test('the reset link request replies identically for unknown and known addresses', function () {
    Platform::admin();

    $known = $this->post(route('platform.password.email'), ['email' => 'admin@example.test']);
    $unknown = $this->post(route('platform.password.email'), ['email' => 'nobody@example.test']);

    expect($known->getSession()->get('status'))->toBe($unknown->getSession()->get('status'));
});

test('the platform session uses its own cookie name', function () {
    Platform::admin();
    $response = signInPassword();

    expect(collect($response->headers->getCookies())->map->getName()->all())->toContain(config('rinquo.platform.cookie'));
});
