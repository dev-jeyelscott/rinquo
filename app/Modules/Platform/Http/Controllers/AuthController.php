<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\RegenerateRecoveryCodes;
use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Auth\Authenticator;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Auth\RecoveryCodes;
use App\Modules\Platform\Http\Requests\FactorRequest;
use App\Modules\Platform\Http\Requests\LoginRequest;
use App\Modules\Platform\Mail\SecurityNoticeMail;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sign-in in two steps. A correct password only opens a short "pending" state; the guard is
 * logged in, and the session regenerated, once the second factor succeeds. A failure at either
 * step is generic so it does not reveal whether an address is an administrator.
 */
class AuthController extends Controller
{
    private const NEW_CODES = 'platform.new_recovery_codes';

    private static ?string $decoyHash = null;

    public function __construct(
        private readonly PlatformSession $sessions,
        private readonly Authenticator $totp,
        private readonly RecoveryCodes $recovery,
    ) {}

    public function showLogin(Request $request): Response
    {
        return Inertia::render('platform/auth/login', [
            'signedOutReason' => $request->session()->get(PlatformSession::REASON_KEY),
        ]);
    }

    public function login(LoginRequest $request): RedirectResponse
    {
        $email = PlatformAdmin::normalizeEmail($request->string('email')->toString());
        $key = 'platform-login:'.hash('sha256', $email).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            PlatformAudit::record('login', 'throttled');
            throw ValidationException::withMessages(['email' => 'Too many sign-in attempts. Try again in a few minutes.']);
        }

        $admin = PlatformAdmin::query()->where('email', $email)->first();
        // Always verify against a hash so an unknown address costs the same as a wrong password.
        $passwordOk = Hash::check($request->string('password')->toString(), $admin === null ? self::decoyHash() : $admin->password);

        if ($admin === null || ! $passwordOk || ! $admin->isActive()) {
            RateLimiter::hit($key, 300);
            PlatformAudit::record('login', 'failed', $admin);
            throw ValidationException::withMessages(['email' => 'These credentials were not accepted.']);
        }

        RateLimiter::clear($key);
        $this->sessions->beginPending($request, $admin);
        PlatformAudit::record('login.password', 'success', $admin);

        return to_route($admin->hasConfirmedFactor() ? 'platform.mfa' : 'platform.enroll');
    }

    public function showFactor(Request $request): Response|RedirectResponse
    {
        $admin = $this->sessions->pending($request);
        if ($admin === null) {
            return to_route('platform.login');
        }
        if (! $admin->hasConfirmedFactor()) {
            return to_route('platform.enroll');
        }

        return Inertia::render('platform/auth/factor', ['email' => $admin->email]);
    }

    public function verifyFactor(FactorRequest $request): RedirectResponse
    {
        $admin = $this->sessions->pending($request);
        if ($admin === null || ! $admin->hasConfirmedFactor()) {
            return to_route('platform.login');
        }

        $key = 'platform-factor:'.$admin->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            PlatformAudit::record('login.factor', 'throttled', $admin);
            throw ValidationException::withMessages(['code' => 'Too many attempts. Wait a few minutes and sign in again.']);
        }

        $usedRecovery = false;
        if ($request->filled('code')) {
            $ok = $this->totp->verifyAndClaim($admin, $request->string('code')->toString());
        } else {
            $ok = $usedRecovery = $this->recovery->consume($admin, $request->string('recovery_code')->toString());
        }

        if (! $ok) {
            RateLimiter::hit($key, 300);
            PlatformAudit::record('login.factor', 'failed', $admin, null, null, ['factor' => $usedRecovery || $request->filled('recovery_code') ? 'recovery' : 'totp']);
            throw ValidationException::withMessages([$request->filled('code') ? 'code' : 'recovery_code' => 'That code was not accepted.']);
        }

        RateLimiter::clear($key);
        $this->sessions->complete($request, $admin);
        PlatformAudit::record('login.factor', 'success', $admin, null, null, ['factor' => $usedRecovery ? 'recovery' : 'totp']);

        if ($usedRecovery) {
            PlatformAudit::record('recovery_code.used', 'success', $admin);
            Mail::to($admin->email)->send(new SecurityNoticeMail('A recovery code was used to sign in to your platform account.'));
        }

        return to_route('platform.overview');
    }

    public function showEnroll(Request $request): Response|RedirectResponse
    {
        $admin = $this->sessions->pending($request);
        if ($admin === null) {
            return to_route('platform.login');
        }
        if ($admin->hasConfirmedFactor()) {
            return to_route('platform.mfa');
        }

        // The unconfirmed secret is kept (encrypted) so a page reload shows the same key.
        if ($admin->totp_secret === null) {
            $admin->forceFill(['totp_secret' => $this->totp->newSecret()])->save();
        }

        return Inertia::render('platform/auth/enroll', [
            'secret' => $admin->totp_secret,
            'otpauthUri' => $this->totp->provisioningUri($admin, (string) $admin->totp_secret),
            'email' => $admin->email,
        ]);
    }

    public function confirmEnroll(FactorRequest $request, RegenerateRecoveryCodes $codes): RedirectResponse
    {
        $admin = $this->sessions->pending($request);
        if ($admin === null || $admin->hasConfirmedFactor() || $admin->totp_secret === null) {
            return to_route('platform.login');
        }

        $key = 'platform-factor:'.$admin->id;
        if (RateLimiter::tooManyAttempts($key, 5) || ! $request->filled('code') || ! $this->totp->verifyAndClaim($admin, $request->string('code')->toString())) {
            RateLimiter::hit($key, 300);
            PlatformAudit::record('factor.enroll', 'failed', $admin);
            throw ValidationException::withMessages(['code' => 'That code was not accepted. Check the key in your authenticator app and try again.']);
        }

        RateLimiter::clear($key);
        $admin->forceFill(['totp_confirmed_at' => CarbonImmutable::now()])->save();
        PlatformAudit::record('factor.enroll', 'success', $admin, 'platform_admin', $admin->id, ['factor' => 'totp']);

        $plain = $codes->handle($admin, 'recovery_codes.generated');
        $this->sessions->complete($request, $admin);
        $request->session()->flash(self::NEW_CODES, $plain);

        return to_route('platform.recovery-codes');
    }

    /** Shows freshly generated codes exactly once: a reload finds nothing. */
    public function showRecoveryCodes(Request $request): Response|RedirectResponse
    {
        $codes = $request->session()->get(self::NEW_CODES);
        if (! is_array($codes)) {
            return to_route('platform.overview');
        }

        return Inertia::render('platform/auth/recovery-codes', ['codes' => array_values($codes)]);
    }

    public function logout(Request $request): RedirectResponse
    {
        $admin = Auth::guard(PlatformSession::GUARD)->user();
        PlatformAudit::record('logout', 'success', $admin instanceof PlatformAdmin ? $admin : null);
        $this->sessions->end($request);

        return to_route('platform.login');
    }

    private static function decoyHash(): string
    {
        return self::$decoyHash ??= Hash::make(Str::random(32));
    }
}
