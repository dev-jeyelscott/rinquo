<?php

use App\Support\Telemetry\ErrorScrubber;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Sentry Cloud error tracking for the backend project (staging and production only: the DSN is
 * absent everywhere else, which disables the SDK). Errors only: tracing, profiling, logs,
 * metrics, breadcrumbs and default PII are off, and every event is rebuilt from an allowlist by
 * ErrorScrubber. Retention (30 days) is a setting of the Sentry project; see
 * docs/operations/monitoring.md. Variables are documented in docs/operations/environments.md.
 */
return [

    'dsn' => env('SENTRY_LARAVEL_DSN') ?: null,

    // One immutable id per build: the image digest or commit SHA, matching the uploaded source maps.
    'release' => env('SENTRY_RELEASE'),

    'environment' => env('SENTRY_ENVIRONMENT', env('APP_ENV')),

    'sample_rate' => 1.0,

    'traces_sample_rate' => null,

    'profiles_sample_rate' => null,

    'enable_logs' => false,

    'enable_metrics' => false,

    'send_default_pii' => false,

    'before_send' => [ErrorScrubber::class, 'scrub'],

    // Expected, user-facing outcomes are not defects.
    'ignore_exceptions' => [
        ValidationException::class,
        AuthenticationException::class,
        AuthorizationException::class,
        TokenMismatchException::class,
        ThrottleRequestsException::class,
        NotFoundHttpException::class,
        HttpException::class,
    ],

    'ignore_transactions' => ['/up', '/ready'],

    'breadcrumbs' => [
        'logs' => false,
        'cache' => false,
        'livewire' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'queue_info' => false,
        'command_info' => false,
        'http_client_requests' => false,
        'notifications' => false,
    ],

    'tracing' => [
        'queue_job_transactions' => false,
        'queue_jobs' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'sql_origin' => false,
        'views' => false,
        'livewire' => false,
        'http_client_requests' => false,
        'cache' => false,
        'redis_commands' => false,
        'notifications' => false,
        'missing_routes' => false,
    ],

];
