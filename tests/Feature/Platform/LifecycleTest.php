<?php

use App\Modules\Platform\Actions\AcceptInvitation;
use App\Modules\Platform\Auth\RecoveryCodes;
use App\Modules\Platform\Mail\InvitationMail;
use App\Modules\Platform\Models\AdminInvitation;
use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\Support\Platform;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->withoutVite();
    $this->admin = Platform::admin();
    $this->as = fn (?PlatformAdmin $a = null) => $this->actingAs($a ?? $this->admin, 'platform')->withSession(Platform::session($a ?? $this->admin));
});

function inviteToken(): string
{
    $url = Mail::sent(InvitationMail::class)->last()->url;

    return basename(parse_url($url, PHP_URL_PATH));
}

test('inviting an admin needs a fresh password and authenticator code', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'])->assertSessionHasErrors(['current_password', 'otp_code']);
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test', 'current_password' => 'wrong', 'otp_code' => '123456'])->assertSessionHasErrors('otp_code');

    expect(AdminInvitation::query()->count())->toBe(0);

    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'New@Example.test'] + Platform::stepUp($this->admin))->assertSessionHasNoErrors();

    $invitation = AdminInvitation::query()->sole();
    expect($invitation->email)->toBe('new@example.test')
        ->and($invitation->token_digest)->toHaveLength(64)
        ->and($invitation->expires_at->isFuture())->toBeTrue();
    Mail::assertSent(InvitationMail::class, 1);
    Mail::assertNotQueued(InvitationMail::class);
    // Only the digest is stored: the emailed token is not in the database.
    expect(json_encode(DB::table('platform_admin_invitations')->get()))->not->toContain(inviteToken());
});

test('an invitation is single-use, creates an admin pending enrollment, and cannot be replayed', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'] + Platform::stepUp($this->admin));
    $token = inviteToken();

    $this->get(route('platform.invitation.show', $token))->assertOk();
    $this->post(route('platform.invitation.accept', $token), ['name' => 'New Admin', 'password' => 'a-long-enough-passphrase', 'password_confirmation' => 'a-long-enough-passphrase'])
        ->assertRedirect(route('platform.enroll'));

    $new = PlatformAdmin::query()->where('email', 'new@example.test')->sole();
    expect($new->hasConfirmedFactor())->toBeFalse()
        ->and(AdminInvitation::query()->sole()->consumed_at)->not->toBeNull();

    $this->post(route('platform.invitation.accept', $token), ['name' => 'Again', 'password' => 'another-long-passphrase', 'password_confirmation' => 'another-long-passphrase'])
        ->assertSessionHasErrors('token');
    expect(PlatformAdmin::query()->count())->toBe(2);
});

test('an expired or revoked invitation is refused', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'] + Platform::stepUp($this->admin));
    $token = inviteToken();

    $this->travel(73)->hours();
    $this->post(route('platform.invitation.accept', $token), ['name' => 'Late', 'password' => 'a-long-enough-passphrase', 'password_confirmation' => 'a-long-enough-passphrase'])
        ->assertSessionHasErrors('token');
    $this->travelBack();

    $invitation = AdminInvitation::query()->sole();
    $invitation->forceFill(['expires_at' => now()->addHour()])->save();
    ($this->as)()->post(route('platform.admins.invitations.revoke', $invitation), Platform::stepUp($this->admin));
    $this->post(route('platform.invitation.accept', $token), ['name' => 'Late', 'password' => 'a-long-enough-passphrase', 'password_confirmation' => 'a-long-enough-passphrase'])
        ->assertSessionHasErrors('token');
    expect(PlatformAdmin::query()->count())->toBe(1);
});

test('accepting the same token twice creates exactly one admin', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'] + Platform::stepUp($this->admin));
    $token = inviteToken();
    $accept = fn () => app(AcceptInvitation::class)->handle($token, 'Winner', 'a-long-enough-passphrase');

    $accept();
    expect($accept)->toThrow(ValidationException::class);
    expect(PlatformAdmin::query()->where('email', 'new@example.test')->count())->toBe(1);
});

test('disabling an admin revokes sessions, factor, recovery codes, support access and pending invitations atomically', function () {
    $target = Platform::admin('target@example.test');
    app(RecoveryCodes::class)->regenerate($target);
    [$user, $organization] = Tenant::organization('shine');
    $support = SupportSession::query()->create([
        'platform_admin_id' => $target->id, 'organization_id' => $organization->id, 'target_user_id' => $user->id,
        'reason' => 'Investigating ticket', 'reference' => 'SUP-1', 'started_at' => now(), 'expires_at' => now()->addMinutes(30),
    ]);
    $invite = AdminInvitation::query()->create(['email' => 'x@example.test', 'token_digest' => str_repeat('a', 64), 'invited_by_admin_id' => $target->id, 'expires_at' => now()->addDay()]);

    ($this->as)()->post(route('platform.admins.disable', $target), Platform::stepUp($this->admin))->assertSessionHasNoErrors();

    $target->refresh();
    expect($target->status)->toBe(PlatformAdmin::DISABLED)
        ->and($target->session_generation)->toBe(2)
        ->and($target->totp_secret)->toBeNull()
        ->and($target->recoveryCodes()->count())->toBe(0)
        ->and($support->fresh()->end_reason)->toBe('admin_disabled')
        ->and($invite->fresh()->revoked_at)->not->toBeNull();

    // The disabled admin's existing session is refused on its very next request.
    $this->actingAs($target, 'platform')->withSession(Platform::session($target, ['platform.generation' => 1]))->get(route('platform.overview'))
        ->assertRedirect(route('platform.login'));
    expect(AuditEvent::query()->where('event', 'admin.disabled')->exists())->toBeTrue();
});

test('an admin cannot disable themselves and a disabled admin returns without a factor', function () {
    ($this->as)()->post(route('platform.admins.disable', $this->admin), Platform::stepUp($this->admin))->assertSessionHasErrors('admin');
    expect($this->admin->fresh()->status)->toBe(PlatformAdmin::ACTIVE);

    $target = Platform::admin('target@example.test');
    ($this->as)()->post(route('platform.admins.disable', $target), Platform::stepUp($this->admin));
    ($this->as)()->post(route('platform.admins.enable', $target), Platform::stepUp($this->admin));
    expect($target->fresh()->isActive())->toBeTrue()->and($target->fresh()->hasConfirmedFactor())->toBeFalse();
});

test('resetting a factor clears it and signs the target out', function () {
    $target = Platform::admin('target@example.test');
    app(RecoveryCodes::class)->regenerate($target);

    ($this->as)()->post(route('platform.admins.reset-factor', $target), Platform::stepUp($this->admin))->assertSessionHasNoErrors();

    $target->refresh();
    expect($target->hasConfirmedFactor())->toBeFalse()->and($target->recoveryCodes()->count())->toBe(0)->and($target->session_generation)->toBe(2);
});

test('regenerating recovery codes replaces the old codes and shows the new ones once', function () {
    $old = app(RecoveryCodes::class)->regenerate($this->admin);

    ($this->as)()->post(route('platform.security.recovery-codes'), Platform::stepUp($this->admin))->assertRedirect(route('platform.recovery-codes'));

    expect($this->admin->recoveryCodes()->count())->toBe(10)
        ->and(app(RecoveryCodes::class)->consume($this->admin, $old[0]))->toBeFalse();
});

test('the platform audit stream is append-only in the database', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'] + Platform::stepUp($this->admin));
    $event = AuditEvent::query()->firstOrFail();

    expect(fn () => DB::table('platform_audit_events')->where('id', $event->id)->update(['result' => 'tampered']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('platform_audit_events')->where('id', $event->id)->delete())->toThrow(QueryException::class);
});

test('audit rows never contain secrets, codes, passwords or tokens', function () {
    ($this->as)()->post(route('platform.admins.invite'), ['email' => 'new@example.test'] + $step = Platform::stepUp($this->admin));
    $token = inviteToken();

    $dump = json_encode(DB::table('platform_audit_events')->get());
    expect($dump)->not->toContain($token)->not->toContain(Platform::PASSWORD)->not->toContain($step['otp_code'])->not->toContain((string) $this->admin->totp_secret);
});

test('the bootstrap command creates the first admin once and never prints the password', function () {
    $this->admin->delete();

    $this->artisan('platform:bootstrap-admin', ['email' => 'first@example.test', '--name' => 'First'])
        ->expectsQuestion('Password (hidden, at least 12 characters)', 'a-long-enough-passphrase')
        ->expectsQuestion('Confirm password', 'a-long-enough-passphrase')
        ->doesntExpectOutputToContain('a-long-enough-passphrase')
        ->assertSuccessful();
    expect(PlatformAdmin::query()->count())->toBe(1);

    $this->artisan('platform:bootstrap-admin', ['email' => 'second@example.test'])
        ->expectsQuestion('Password (hidden, at least 12 characters)', 'another-long-passphrase')
        ->expectsQuestion('Confirm password', 'another-long-passphrase')
        ->expectsOutputToContain('already exists')
        ->assertSuccessful();
    expect(PlatformAdmin::query()->count())->toBe(1);
});

test('the bootstrap command rejects a weak password', function () {
    $this->admin->delete();

    $this->artisan('platform:bootstrap-admin', ['email' => 'first@example.test'])
        ->expectsQuestion('Password (hidden, at least 12 characters)', 'short')
        ->expectsQuestion('Confirm password', 'short')
        ->assertFailed();
    expect(PlatformAdmin::query()->count())->toBe(0);
});
