<?php

namespace App\Modules\Customer\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\RequestLoginCode;
use App\Modules\Identity\Actions\VerifyLoginCode;
use App\Modules\Identity\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAuthController extends Controller
{
    private const TOKEN = 'customer_login.token';

    private const EMAIL = 'customer_login.email';

    private const SENT_AT = 'customer_login.sent_at';

    public function show(Request $request): Response
    {
        $email = $request->session()->get(self::EMAIL);
        $sentAt = (int) $request->session()->get(self::SENT_AT, 0);
        $cooldown = (int) config('rinquo.otp.resend_cooldown_seconds');

        return Inertia::render('customer/auth/login', [
            'step' => is_string($email) && $request->session()->has(self::TOKEN) ? 'code' : 'email',
            'email' => is_string($email) ? $email : null,
            'resendInSeconds' => max(0, $sentAt + $cooldown - now()->getTimestamp()),
            'codeLength' => 6,
        ]);
    }

    public function requestCode(Request $request, RequestLoginCode $action): RedirectResponse
    {
        $email = User::normalizeEmail((string) $request->validate(['email' => ['required', 'email:rfc', 'max:254']])['email']);
        // Resending and changing the address both use this request; the newest challenge wins only once its code was sent.
        $request->session()->put([self::TOKEN => $action->handle($email, (string) $request->ip()), self::EMAIL => $email, self::SENT_AT => now()->getTimestamp()]);

        return to_route('customer.auth.login');
    }

    public function verify(Request $request, VerifyLoginCode $action): RedirectResponse
    {
        $code = (string) $request->validate(['code' => ['required', 'digits:6']])['code'];
        $user = $action->handle($request->session()->get(self::TOKEN), $code, (string) $request->ip());
        Auth::login($user, remember: true);
        $request->session()->forget([self::TOKEN, self::EMAIL, self::SENT_AT]);
        $request->session()->regenerate();

        return to_route('customer.directory');
    }
}
