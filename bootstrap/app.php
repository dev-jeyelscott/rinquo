<?php

use App\Http\Controllers\ReadinessController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Modules\Subscription\Http\Controllers\PayMongoWebhookController;
use App\Support\Logging\AssignRequestId;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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
            Route::post('/webhooks/paymongo', PayMongoWebhookController::class)->middleware('throttle:paymongo-webhook')->name('webhooks.paymongo');
        },
    )
    ->withCommands([
        __DIR__.'/../app/Modules/Booking/Console',
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

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Error-tracking integration point: a provider SDK hooks in here with
        // $exceptions->report(...). Until one is chosen, reported exceptions go
        // to the configured log channel (JSON on stderr in staging/production).
        $exceptions->dontReportDuplicates();

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
