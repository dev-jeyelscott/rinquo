<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Models\PlatformAdmin;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every platform request re-reads the administrator and re-checks active state, session
 * generation, the 12-hour absolute limit and the 30-minute inactivity limit. A password-only
 * session never reaches here: the guard is logged in only after the second factor.
 */
final class EnsurePlatformAdmin
{
    public function __construct(private readonly PlatformSession $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $admin = Auth::guard(PlatformSession::GUARD)->user();

        if (! $admin instanceof PlatformAdmin) {
            return redirect()->route('platform.login');
        }

        $violation = $this->sessions->violation($request->session(), $admin);
        if ($violation !== null) {
            PlatformAudit::record('session.ended', $violation, $admin);
            $this->sessions->end($request, $violation);

            return redirect()->route('platform.login');
        }

        $this->sessions->touch($request->session());

        return $next($request);
    }
}
