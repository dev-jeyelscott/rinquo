<?php

namespace App\Modules\Platform;

use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\DB;
use OTPHP\TOTP;

/**
 * Browser-test support: provisions a platform administrator with a known password and
 * authenticator secret, and reads the current authenticator code, so Playwright can complete
 * the real two-factor sign-in. Registered ONLY when APP_ENV is "testing", exactly like the
 * other testing fixtures; in every other environment neither route exists. The routes sit
 * outside the web and platform groups (no session, no CSRF), like a test harness endpoint.
 */
final class TestingPlatformFixture
{
    public const PASSWORD = 'e2e-platform-passphrase';

    public static function register(?Router $router = null): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        $router ??= app('router');

        $router->post('__testing/platform/admin', fn (Request $request) => self::seed($request))->name('testing.platform.admin');
        $router->get('__testing/platform/code', fn (Request $request) => self::code((string) $request->query('email')))->name('testing.platform.code');
    }

    private static function seed(Request $request): JsonResponse
    {
        $email = PlatformAdmin::normalizeEmail($request->validate(['email' => ['required', 'email', 'max:254']])['email']);
        $secret = TOTP::generate()->getSecret();

        $admin = PlatformAdmin::query()->create(['email' => $email, 'name' => 'E2E Administrator', 'password' => self::PASSWORD]);
        $admin->forceFill(['totp_secret' => $secret, 'totp_confirmed_at' => CarbonImmutable::now()])->save();

        return response()->json(['email' => $email, 'password' => self::PASSWORD]);
    }

    /** The current code. It clears the replay marker so one test can use several codes in one time step. */
    private static function code(string $email): JsonResponse
    {
        $admin = PlatformAdmin::query()->where('email', PlatformAdmin::normalizeEmail($email))->first();
        if ($admin === null || $admin->totp_secret === null || $admin->totp_secret === '') {
            return response()->json(['code' => null], 404);
        }
        DB::table('platform_admins')->where('id', $admin->id)->update(['totp_last_step' => 0]);

        return response()->json(['code' => TOTP::createFromSecret($admin->totp_secret)->now()]);
    }
}
