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

    public function show(Request $request): Response
    {
        $email = $request->session()->get(self::EMAIL);

        return Inertia::render('customer/auth/login', ['step' => is_string($email) && $request->session()->has(self::TOKEN) ? 'code' : 'email', 'email' => $email, 'codeLength' => 6]);
    }

    public function requestCode(Request $request, RequestLoginCode $action): RedirectResponse
    {
        $email = User::normalizeEmail((string) $request->validate(['email' => ['required', 'email:rfc,dns', 'max:255']])['email']);
        $request->session()->put([self::TOKEN => $action->handle($email, (string) $request->ip()), self::EMAIL => $email]);

        return to_route('customer.auth.login');
    }

    public function verify(Request $request, VerifyLoginCode $action): RedirectResponse
    {
        $code = (string) $request->validate(['code' => ['required', 'digits:6']])['code'];
        $user = $action->handle($request->session()->get(self::TOKEN), $code, (string) $request->ip());
        Auth::login($user, remember: true);
        $request->session()->forget([self::TOKEN, self::EMAIL]);
        $request->session()->regenerate();

        return to_route('customer.directory');
    }
}
