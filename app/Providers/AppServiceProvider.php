<?php

namespace App\Providers;

use App\Support\Environment\RequiredEnvironment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment(['staging', 'production'])) {
            $this->app->make(RequiredEnvironment::class)->assertPresent();
        }

        $this->configureDefaults();
        $this->configureTrustedProxies();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            $this->app->isProduction(),
        );
    }

    /**
     * Trust X-Forwarded-* headers only from the configured proxies.
     */
    protected function configureTrustedProxies(): void
    {
        $proxies = array_values(array_filter(array_map(
            trim(...),
            explode(',', (string) config('app.trusted_proxies')),
        )));

        if ($proxies === []) {
            return;
        }

        TrustProxies::at($proxies === ['*'] ? '*' : $proxies);
    }
}
