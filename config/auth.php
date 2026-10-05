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
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => User::class,
        ],
    ],

    'passwords' => [],

];
