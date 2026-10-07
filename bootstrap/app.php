<?php

use App\Http\Controllers\ReadinessController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Modules\Platform\Http\Middleware\UsePlatformSession;
use App\Modules\Subscription\Http\Controllers\PayMongoWebhookController;
use App\Support\Logging\AssignRequestId;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function (): void {
            // Readiness is registered outside the "web" group on purpose: no
            // session, cookie or CSRF middleware (Redis-backed sessions) runs
            // before the checks, so an outage is reported as 503, not 500.
            Route::get('/ready', ReadinessController::class)->name('ready');

            // The PayMongo webhook is server-to-server and authenticated by its signature, so it
            // has no session, cookie or CSRF middleware either.
            // Platform administration: a separate guard, session cookie and middleware group (no tenant session).
            Route::middleware('platform')->prefix('platform')->name('platform.')->group(base_path('routes/platform.php'));

            Route::post('/webhooks/paymongo', PayMongoWebhookController::class)->middleware('throttle:paymongo-webhook')->name('webhooks.paymongo');
        },
    )
    ->withCommands([
        __DIR__.'/../app/Modules/Booking/Console',
        __DIR__.'/../app/Modules/Platform/Console',
        __DIR__.'/../app/Modules/Subscription/Console',
        __DIR__.'/../app/Modules/Tenancy/Console',
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);

        // Trusted proxies come from config('app.trusted_proxies') and are applied
        // in AppServiceProvider, so they keep working with a cached config.
        $middleware->trustHosts();

        $middleware->redirectGuestsTo(fn (Request $request) => route('owner.auth.login'));
        $middleware->redirectUsersTo(fn (Request $request) => route('owner.home'));

        // The platform surface has its own cookie/session namespace, so it is not part of the "web" group.
        $middleware->group('platform', [
            UsePlatformSession::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            ValidateCsrfToken::class,
            SubstituteBindings::class,
            HandleInertiaRequests::class,
        ]);
        $middleware->prependToPriorityList(before: StartSession::class, prepend: UsePlatformSession::class);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Reported exceptions go to the configured log channel (JSON on stderr in
        // staging/production) and, when a DSN is configured, to Sentry through the
        // allowlist scrubber in config/sentry.php. A telemetry outage never affects rendering.
        Integration::handles($exceptions);
        $exceptions->dontReportDuplicates();
        // Never flash second-factor material back into a form after a validation failure.
        $exceptions->dontFlash(['otp_code', 'code', 'recovery_code']);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
