<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Register the Horizon gate.
     *
     * Horizon itself allows the dashboard in the "local" environment. Everywhere
     * else it is denied until platform administration (with 2FA) exists; use
     * `php artisan horizon:status` and `php artisan queue:failed` meanwhile.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', fn (?object $user = null): bool => false);
    }
}
