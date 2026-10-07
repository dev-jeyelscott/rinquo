<?php

use App\Modules\Identity\Models\User;

/*
| Owners sign in with an emailed one-time code through the browser session
| (CSRF-protected "web" middleware). There are no passwords or API tokens.
*/
return [

    'defaults' => [
        'guard' => 'web',
        'passwords' => null,
    ],

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
        // Platform administrators are a separate identity with their own guard, provider and session cookie.
        'platform' => [
            'driver' => 'session',
            'provider' => 'platform_admins',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => User::class,
        ],
        // Registered in AppServiceProvider (it resolves PlatformAdmin). It has no `model` key on purpose:
        // static analysis then keeps typing $request->user() as the tenant User on the default guard.
        'platform_admins' => [
            'driver' => 'platform-admins',
        ],
    ],

    'passwords' => [
        // Email reset changes the password only: it never signs in and never bypasses the second factor.
        'platform_admins' => [
            'provider' => 'platform_admins',
            'table' => 'platform_password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

];
