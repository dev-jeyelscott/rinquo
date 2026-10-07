<?php

namespace App\Modules\Platform\Auth;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\RecoveryCode;
use Carbon\CarbonImmutable;

/**
 * Single-use recovery codes. Generated from a CSPRNG, stored only as keyed hashes, shown
 * once, and consumed with a conditional update so a code can win at most once.
 */
final class RecoveryCodes
{
    private const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    /**
     * Replaces every existing code and returns the new plaintext codes, which exist only in this return value.
     *
     * @return list<string>
     */
    public function regenerate(PlatformAdmin $admin): array
    {
        $admin->recoveryCodes()->delete();

        $codes = [];
        for ($i = 0; $i < (int) config('rinquo.platform.recovery_code_count'); $i++) {
            $code = $this->randomCode();
            $codes[] = $code;
            RecoveryCode::query()->create(['platform_admin_id' => $admin->id, 'code_digest' => $this->digest($code)]);
        }

        return $codes;
    }

    /** True when the code was valid and unused; it is then spent for good. */
    public function consume(PlatformAdmin $admin, string $code): bool
    {
        return $admin->recoveryCodes()
            ->where('code_digest', $this->digest($code))
            ->whereNull('consumed_at')
            ->update(['consumed_at' => CarbonImmutable::now()]) === 1;
    }

    public function remaining(PlatformAdmin $admin): int
    {
        return $admin->recoveryCodes()->whereNull('consumed_at')->count();
    }

    private function randomCode(): string
    {
        $out = '';
        for ($i = 0; $i < 10; $i++) {
            $out .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return substr($out, 0, 5).'-'.substr($out, 5);
    }

    private function digest(string $code): string
    {
        $normalized = preg_replace('/[^a-z0-9]/', '', mb_strtolower($code)) ?? '';

        return hash_hmac('sha256', $normalized, (string) config('app.key'));
    }
}
