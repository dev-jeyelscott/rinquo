<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Platform\Auth\PlatformSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives the platform surface its own session cookie and idle lifetime, and makes the
 * platform guard the default for the request. It must run before StartSession.
 */
final class UsePlatformSession
{
    public function handle(Request $request, Closure $next): Response
    {
        config([
            'session.cookie' => config('rinquo.platform.cookie'),
            'session.lifetime' => (int) config('rinquo.platform.session_idle_minutes'),
            'session.same_site' => 'strict',
        ]);
        Auth::shouldUse(PlatformSession::GUARD);

        $response = $next($request);
        // Authenticated pages carry privileged data: never store them in a shared or browser cache.
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
