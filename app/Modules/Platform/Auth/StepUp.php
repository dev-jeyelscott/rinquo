<?php

namespace App\Modules\Platform\Auth;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\PlatformAdmin;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Password-plus-factor re-authentication at the moment of a sensitive action. The
 * assertion is single-purpose: it is verified inside the request that acts and is never
 * stored, so there is nothing to replay or to carry to another action.
 */
final class StepUp
{
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 300;

    public function __construct(private readonly Authenticator $totp) {}

    public function verify(PlatformAdmin $admin, string $password, string $code): bool
    {
        $key = 'platform-step-up:'.$admin->id;
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            PlatformAudit::record('step_up', 'throttled', $admin);

            return false;
        }

        $passwordOk = Hash::check($password, $admin->password);
        $factorOk = $admin->hasConfirmedFactor() && $this->totp->verifyAndClaim($admin, $code);

        if (! ($passwordOk && $factorOk)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            PlatformAudit::record('step_up', 'failed', $admin);

            return false;
        }

        RateLimiter::clear($key);

        return true;
    }
}
