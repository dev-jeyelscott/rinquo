<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\AcceptInvitation;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Http\Requests\AcceptInvitationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InvitationController extends Controller
{
    public function show(string $token, AcceptInvitation $invitations): Response
    {
        return Inertia::render('platform/auth/accept-invitation', ['token' => $token, 'usable' => $invitations->isUsable($token)]);
    }

    public function accept(AcceptInvitationRequest $request, string $token, AcceptInvitation $invitations, PlatformSession $sessions): RedirectResponse
    {
        $key = 'platform-invitation:'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['token' => 'Too many attempts. Try again later.']);
        }
        RateLimiter::hit($key, 900);

        $admin = $invitations->handle($token, $request->string('name')->toString(), $request->string('password')->toString());
        // The invited admin proved possession of the link and chose a password; the factor is enrolled next.
        $sessions->beginPending($request, $admin);

        return to_route('platform.enroll');
    }
}
