<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\RequestLoginCode;
use App\Modules\Identity\Actions\VerifyLoginCode;
use App\Modules\Identity\Http\Requests\RequestLoginCodeRequest;
use App\Modules\Identity\Http\Requests\VerifyLoginCodeRequest;
use App\Modules\Identity\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class OwnerAuthController extends Controller
{
    private const TOKEN = 'owner_login.token';

    private const EMAIL = 'owner_login.email';

    private const SENT_AT = 'owner_login.sent_at';

    public function show(Request $request): Response
    {
        $email = $request->session()->get(self::EMAIL);
        $sentAt = (int) $request->session()->get(self::SENT_AT, 0);
        $cooldown = (int) config('rinquo.otp.resend_cooldown_seconds');

        return Inertia::render('owner/auth/login', [
            'step' => is_string($email) && $request->session()->has(self::TOKEN) ? 'code' : 'email',
            'email' => is_string($email) ? $email : null,
            'resendInSeconds' => max(0, $sentAt + $cooldown - now()->getTimestamp()),
            'codeLength' => 6,
            'cooldownSeconds' => $cooldown,
        ]);
    }

    public function requestCode(RequestLoginCodeRequest $request, RequestLoginCode $action): RedirectResponse
    {
        $email = User::normalizeEmail($request->string('email')->toString());
        $token = $action->handle($email, (string) $request->ip());

        $request->session()->put([
            self::TOKEN => $token, // newest challenge wins for this browser
            self::EMAIL => $email,
            self::SENT_AT => now()->getTimestamp(),
        ]);

        return to_route('owner.auth.login');
    }

    public function verify(VerifyLoginCodeRequest $request, VerifyLoginCode $action): RedirectResponse
    {
        $token = $request->session()->get(self::TOKEN);

        $user = $action->handle(is_string($token) ? $token : null, $request->string('code')->toString(), (string) $request->ip());

        Auth::login($user, remember: true);
        $request->session()->forget([self::TOKEN, self::EMAIL, self::SENT_AT]);
        $request->session()->regenerate();

        return to_route('owner.home');
    }

    public function restart(Request $request): RedirectResponse
    {
        $request->session()->forget([self::TOKEN, self::EMAIL, self::SENT_AT]);

        return to_route('owner.auth.login');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('owner.auth.login');
    }
}
