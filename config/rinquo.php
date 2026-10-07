<?php

use App\Modules\Subscription\Jobs\ProcessWebhookEvent;

return [

    /*
    |--------------------------------------------------------------------------
    | Owner email one-time codes
    |--------------------------------------------------------------------------
    */
    'otp' => [
        'expires_minutes' => 10,
        'resend_cooldown_seconds' => 60,
        'max_failed_attempts' => 5,
        // Requests per hour for one normalized email (hashed) and for one IP.
        'request_per_email_per_hour' => 5,
        // Overridable so browser tests that share one IP are not throttled.
        'request_per_ip_per_hour' => (int) env('RINQUO_OTP_REQUESTS_PER_IP_PER_HOUR', 20),
        // Verification attempts per IP per ten minutes.
        'verify_per_ip' => (int) env('RINQUO_OTP_VERIFY_PER_IP', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Customer booking
    |--------------------------------------------------------------------------
    |
    | Platform-wide limits. The per-shop approval mode and time rules are the
    | Owner's booking policy (booking_policies), not configuration.
    */
    'booking' => [
        // How long a checkout hold keeps its time reserved.
        'hold_minutes' => (int) env('RINQUO_BOOKING_HOLD_MINUTES', 15),
        // Hold creations per IP within the decay window (anonymous holds are a capacity-exhaustion vector).
        'hold_requests_per_ip' => (int) env('RINQUO_BOOKING_HOLD_REQUESTS_PER_IP', 30),
        'hold_decay_minutes' => 10,
        'confirm_per_ip' => (int) env('RINQUO_BOOKING_CONFIRM_PER_IP', 30),
        'confirm_decay_minutes' => 10,
        // The reminder email goes out this many hours before the start.
        'reminder_hours_before' => 24,
    ],

    /*
    |--------------------------------------------------------------------------
    | Subscription plan terms
    |--------------------------------------------------------------------------
    |
    | One global plan. amount, trial and grace are the deployment defaults used until
    | a Platform Admin publishes a plan_term_versions row; the latest effective
    | version then wins. Read only through Subscription\Support\PlanTerms, which
    | validates them. Requests and payments snapshot the amount, so changing it
    | never rewrites history or a current entitlement period. Locked default grace
    | is 3 days (Decision 105).
    */
    'subscription' => [
        'currency' => 'PHP',
        'amount_centavos' => (int) env('RINQUO_PLAN_AMOUNT_CENTAVOS', 99900),
        'trial_days' => (int) env('RINQUO_TRIAL_DAYS', 14),
        'grace_days' => (int) env('RINQUO_GRACE_DAYS', 3),
        // A Rinquo renewal request stays payable this long.
        'request_lifetime_hours' => 24,
        // One provider QR lives at most this long (PayMongo allows 60 to 9000 seconds).
        'qr_lifetime_seconds' => (int) env('RINQUO_QR_LIFETIME_SECONDS', 1800),
        'reminder_offsets_days' => [7, 3, 1],
        // Webhook timestamps older (or newer) than this are rejected.
        'signature_tolerance_seconds' => (int) env('RINQUO_WEBHOOK_TOLERANCE_SECONDS', 300),
        // Owner closure keeps the organization recoverable for this long.
        'closure_recovery_days' => 90,
    ],

    /*
    |--------------------------------------------------------------------------
    | Platform administration
    |--------------------------------------------------------------------------
    */
    'platform' => [
        // Absolute and inactivity limits for a platform session.
        'session_absolute_minutes' => 720,
        'session_idle_minutes' => 30,
        // The password step of sign-in stays valid this long while the second factor is entered.
        'pending_factor_minutes' => 10,
        'invitation_hours' => 72,
        'cookie' => 'rinquo-platform-session',
        'recovery_code_count' => 10,
        // A support session is read-only, one organization and at most 30 minutes (a database CHECK also enforces it).
        'support_minutes' => 30,
        // Failed jobs that are proven safe to run again. Everything else stays visible but cannot be retried.
        'retryable_jobs' => [
            ProcessWebhookEvent::class => 'Settles a stored webhook event; a settled event is a no-op.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Browser error tracking
    |--------------------------------------------------------------------------
    |
    | The browser Sentry project's DSN (a public identifier, separate from the backend
    | project). Read at runtime so the same image serves staging and production; absent
    | everywhere else, which disables browser reporting. The release is the backend's
    | SENTRY_RELEASE so server and browser reports share one build id.
    */
    'telemetry' => [
        'browser_dsn' => env('SENTRY_BROWSER_DSN') ?: null,
    ],

    /*
    |--------------------------------------------------------------------------
    | Tenant media
    |--------------------------------------------------------------------------
    |
    | Private disk for tenant logos and photos. Objects are never public; the
    | application streams them through organization-scoped routes.
    */
    'media_disk' => env('RINQUO_MEDIA_DISK', env('FILESYSTEM_DISK', 's3')),

];
