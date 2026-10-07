<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Http\Requests\ResetPasswordRequest;
use App\Modules\Platform\Mail\SecurityNoticeMail;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Email reset changes the password and nothing else: it never signs anyone in and never
 * touches the second factor. The request reply is identical whether or not the address exists.
 */
class PasswordResetController extends Controller
{
    public function showForgot(): Response
    {
        return Inertia::render('platform/auth/forgot-password');
    }

    public function sendLink(Request $request): RedirectResponse
    {
        $email = PlatformAdmin::normalizeEmail($request->validate(['email' => ['required', 'email', 'max:254']])['email']);
        $key = 'platform-reset-request:'.$request->ip();

        if (! RateLimiter::tooManyAttempts($key, 5)) {
            RateLimiter::hit($key, 3600);
            $admin = PlatformAdmin::query()->where('email', $email)->first();
            if ($admin?->isActive()) {
                Password::broker('platform_admins')->sendResetLink(['email' => $email]);
                PlatformAudit::record('password_reset.requested', 'success', $admin);
            }
        }

        return to_route('platform.login')->with('status', 'If that address belongs to an administrator, a reset link is on its way.');
    }

    public function showReset(Request $request, string $token): Response
    {
        return Inertia::render('platform/auth/reset-password', ['token' => $token, 'email' => (string) $request->query('email', '')]);
    }

    public function reset(ResetPasswordRequest $request): RedirectResponse
    {
        $key = 'platform-reset:'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['email' => 'Too many attempts. Try again later.']);
        }
        RateLimiter::hit($key, 900);

        $credentials = ['email' => PlatformAdmin::normalizeEmail($request->string('email')->toString()), 'password' => $request->string('password')->toString(), 'password_confirmation' => $request->string('password_confirmation')->toString(), 'token' => $request->string('token')->toString()];

        $status = Password::broker('platform_admins')->reset($credentials, function (PlatformAdmin $admin, string $password): void {
            if (! $admin->isActive()) {
                return;
            }
            // New generation signs out every session; the factor is untouched and still required.
            $admin->forceFill(['password' => $password, 'password_changed_at' => CarbonImmutable::now(), 'session_generation' => $admin->session_generation + 1])->save();
            PlatformAudit::record('password_reset.completed', 'success', $admin);
            Mail::to($admin->email)->send(new SecurityNoticeMail('The password on your platform account was changed.'));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired.']);
        }

        return to_route('platform.login')->with('status', 'Password changed. Sign in with your password and your second factor.');
    }
}
