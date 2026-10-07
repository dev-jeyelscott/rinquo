<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Platform\Auth\PlatformSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Sign-in screens are for guests only. */
final class RedirectAuthenticatedAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        return Auth::guard(PlatformSession::GUARD)->check() ? redirect()->route('platform.overview') : $next($request);
    }
}
