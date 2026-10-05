<?php

namespace App\Providers;

use App\Modules\Booking\Conflicts\ScheduleImpactGate;
use App\Modules\Booking\TestingShopFixture;
use App\Modules\Identity\TestingOtpPeek;
use App\Modules\Tenancy\Contracts\ChangeImpact;
use App\Support\Environment\RequiredEnvironment;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Scheduling changes settle their impact on future bookings through the Booking module.
        $this->app->bind(ChangeImpact::class, ScheduleImpactGate::class);
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

        $this->configureBookingRateLimits();

        TestingOtpPeek::register();
        TestingShopFixture::register();
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

    /** Anonymous holds are a capacity-exhaustion vector, so creating and confirming them is throttled per IP. */
    protected function configureBookingRateLimits(): void
    {
        RateLimiter::for('booking-holds', fn (Request $request) => Limit::perMinutes(
            (int) config('rinquo.booking.hold_decay_minutes'),
            (int) config('rinquo.booking.hold_requests_per_ip'),
        )->by($request->ip()));

        RateLimiter::for('booking-confirm', fn (Request $request) => Limit::perMinutes(
            (int) config('rinquo.booking.confirm_decay_minutes'),
            (int) config('rinquo.booking.confirm_per_ip'),
        )->by($request->ip()));
    }
}
