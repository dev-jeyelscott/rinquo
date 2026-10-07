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
     * else it is denied: its routes run in the tenant `web` group (a different session
     * and guard from /platform) and its generic retry controls cannot enforce the
     * platform allowlist, step-up and audit. Use `/platform/failed-jobs`,
     * `php artisan horizon:status` and `php artisan queue:failed` instead.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', fn (?object $user = null): bool => false);
    }
}
