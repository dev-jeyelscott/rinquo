<?php

namespace App\Modules\Platform\Auth;

use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The platform session lifecycle: a password-only "pending" state that is not an
 * authenticated session, completion once the second factor succeeds, and the absolute,
 * inactivity and generation checks every request makes.
 */
final class PlatformSession
{
    public const GUARD = 'platform';

    private const PENDING = 'platform.pending';

    private const STARTED = 'platform.started_at';

    private const ACTIVITY = 'platform.last_activity';

    private const GENERATION = 'platform.generation';

    public const REASON_KEY = 'platform.signed_out_reason';

    public function beginPending(Request $request, PlatformAdmin $admin): void
    {
        $request->session()->regenerate();
        $request->session()->put(self::PENDING, ['admin' => $admin->id, 'generation' => $admin->session_generation, 'at' => CarbonImmutable::now()->getTimestamp()]);
    }

    /** The admin whose password step succeeded recently and who has not completed the factor, or null. */
    public function pending(Request $request): ?PlatformAdmin
    {
        $pending = $request->session()->get(self::PENDING);
        if (! is_array($pending)) {
            return null;
        }
        $ttl = (int) config('rinquo.platform.pending_factor_minutes') * 60;
        $admin = PlatformAdmin::query()->find((int) ($pending['admin'] ?? 0));

        if ($admin === null || ! $admin->isActive() || $admin->session_generation !== ($pending['generation'] ?? 0)
            || CarbonImmutable::now()->getTimestamp() - (int) ($pending['at'] ?? 0) > $ttl) {
            $request->session()->forget(self::PENDING);

            return null;
        }

        return $admin;
    }

    public function complete(Request $request, PlatformAdmin $admin): void
    {
        $session = $request->session();
        $session->forget(self::PENDING);
        Auth::guard(self::GUARD)->login($admin);
        $session->regenerate();
        $now = CarbonImmutable::now()->getTimestamp();
        $session->put([self::STARTED => $now, self::ACTIVITY => $now, self::GENERATION => $admin->session_generation]);
        $admin->forceFill(['last_login_at' => CarbonImmutable::now()])->save();
    }

    /** Null when the session is acceptable; otherwise the reason it ended. */
    public function violation(Session $session, PlatformAdmin $admin): ?string
    {
        $now = CarbonImmutable::now()->getTimestamp();

        return match (true) {
            ! $admin->isActive() || $session->get(self::GENERATION) !== $admin->session_generation => 'revoked',
            $now - (int) $session->get(self::STARTED, 0) > (int) config('rinquo.platform.session_absolute_minutes') * 60 => 'expired',
            $now - (int) $session->get(self::ACTIVITY, 0) > (int) config('rinquo.platform.session_idle_minutes') * 60 => 'idle',
            default => null,
        };
    }

    public function touch(Session $session): void
    {
        $session->put(self::ACTIVITY, CarbonImmutable::now()->getTimestamp());
    }

    public function end(Request $request, ?string $reason = null): void
    {
        Auth::guard(self::GUARD)->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        if ($reason !== null) {
            $request->session()->flash(self::REASON_KEY, $reason);
        }
    }
}
