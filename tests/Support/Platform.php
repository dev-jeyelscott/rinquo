<?php

namespace Tests\Support;

use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use OTPHP\TOTP;

/** Builders for platform administration tests. */
final class Platform
{
    public const PASSWORD = 'correct-horse-battery-staple';

    public static function admin(string $email = 'admin@example.test', bool $factor = true): PlatformAdmin
    {
        $admin = PlatformAdmin::query()->create(['email' => $email, 'name' => 'Admin', 'password' => self::PASSWORD]);

        if ($factor) {
            $admin->forceFill(['totp_secret' => TOTP::generate()->getSecret(), 'totp_confirmed_at' => CarbonImmutable::now()])->save();
        }

        return $admin->fresh();
    }

    /** The current authenticator code. Clears the replay marker first so a test can use several codes in one time step. */
    public static function code(PlatformAdmin $admin): string
    {
        DB::table('platform_admins')->where('id', $admin->id)->update(['totp_last_step' => 0]);

        return TOTP::createFromSecret((string) $admin->fresh()->totp_secret)->at(CarbonImmutable::now()->getTimestamp());
    }

    /** @return array<string, string> a valid password-plus-factor step-up payload */
    public static function stepUp(PlatformAdmin $admin): array
    {
        return ['current_password' => self::PASSWORD, 'otp_code' => self::code($admin)];
    }

    /** @return array<string, int> session state of a fully signed-in administrator */
    public static function session(PlatformAdmin $admin, array $overrides = []): array
    {
        $now = CarbonImmutable::now()->getTimestamp();

        return array_merge([
            'platform.generation' => $admin->session_generation,
            'platform.started_at' => $now,
            'platform.last_activity' => $now,
        ], $overrides);
    }
}
