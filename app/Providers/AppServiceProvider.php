<?php

namespace App\Providers;

use App\Modules\Booking\Conflicts\ScheduleImpactGate;
use App\Modules\Booking\TestingShopFixture;
use App\Modules\Identity\TestingOtpPeek;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\TestingPlatformFixture;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Subscription\PayMongo\PayMongoHttpGateway;
use App\Modules\Tenancy\Contracts\ChangeImpact;
use App\Support\Environment\RequiredEnvironment;
use Carbon\CarbonImmutable;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Sentry\State\Scope;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Scheduling changes settle their impact on future bookings through the Booking module.
        $this->app->bind(ChangeImpact::class, ScheduleImpactGate::class);
        // The outbound PayMongo boundary; tests and the browser fixture replace it with a fake.
        $this->app->bind(PayMongoGateway::class, PayMongoHttpGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment(['staging', 'production'])) {
            $this->app->make(RequiredEnvironment::class)->assertPresent();
        }

        // The platform guard's provider: an Eloquent provider over the separate administrator table.
        Auth::provider('platform-admins', fn ($app, array $config) => new EloquentUserProvider($app['hash'], PlatformAdmin::class));

        $this->configureDefaults();
        $this->configureTrustedProxies();

        $this->configureBookingRateLimits();
        $this->configureBillingRateLimits();
        $this->tagFailingJobClass();

        TestingOtpPeek::register();
        TestingShopFixture::register();
        TestingPlatformFixture::register();
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

    /** Renewal creates provider objects, and the webhook is public: both are throttled. */
    protected function configureBillingRateLimits(): void
    {
        RateLimiter::for('billing-renewal', fn (Request $request) => Limit::perMinute(10)->by((string) ($request->user()->id ?? $request->ip())));
        RateLimiter::for('paymongo-webhook', fn (Request $request) => Limit::perMinute(300)->by($request->ip()));
    }

    /** Lets an error report name the job class (and nothing of its payload) when a queued job fails. */
    protected function tagFailingJobClass(): void
    {
        if (config('sentry.dsn') === null) {
            return;
        }

        Queue::before(function (JobProcessing $event): void {
            \Sentry\configureScope(fn (Scope $scope) => $scope->setTag('job_class', $event->job->resolveName()));
        });
    }
}
