<?php

namespace App\Modules\Platform\Auth;

use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use OTPHP\TOTP;

/**
 * RFC 6238 time-based codes through the maintained OTPHP library (SHA-1, 6 digits, 30 s,
 * one step of clock skew either way). A time step is accepted at most once per admin.
 */
final class Authenticator
{
    private const PERIOD = 30;

    public function newSecret(): string
    {
        return TOTP::generate()->getSecret();
    }

    public function provisioningUri(PlatformAdmin $admin, string $secret): string
    {
        if ($secret === '') {
            throw new InvalidArgumentException('An authenticator secret is required.');
        }

        $totp = TOTP::createFromSecret($secret);
        $totp->setLabel($admin->email === '' ? 'administrator' : $admin->email);
        $totp->setIssuer((string) config('app.name') === '' ? 'Rinquo' : (string) config('app.name'));

        return $totp->getProvisioningUri();
    }

    /** Verifies the code against the stored secret and atomically claims its time step (replay-safe). */
    public function verifyAndClaim(PlatformAdmin $admin, string $code, ?string $secret = null): bool
    {
        $secret ??= $admin->totp_secret;
        if ($secret === null || $secret === '' || preg_match('/^\d{6}$/', $code) !== 1) {
            return false;
        }

        $totp = TOTP::createFromSecret($secret);
        $now = CarbonImmutable::now()->getTimestamp();
        $matched = null;
        foreach ([-1, 0, 1] as $offset) {
            $timestamp = max(0, $now + ($offset * self::PERIOD));
            if (hash_equals($totp->at($timestamp), $code)) {
                $matched = intdiv($timestamp, self::PERIOD);
            }
        }
        if ($matched === null) {
            return false;
        }

        // Conditional update: two concurrent submissions of the same code cannot both win.
        $claimed = DB::table('platform_admins')
            ->where('id', $admin->id)
            ->where('totp_last_step', '<', $matched)
            ->update(['totp_last_step' => $matched]);

        if ($claimed === 1) {
            $admin->totp_last_step = $matched;
        }

        return $claimed === 1;
    }
}
