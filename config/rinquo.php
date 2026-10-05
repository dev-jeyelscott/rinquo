<?php

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
    | Tenant media
    |--------------------------------------------------------------------------
    |
    | Private disk for tenant logos and photos. Objects are never public; the
    | application streams them through organization-scoped routes.
    */
    'media_disk' => env('RINQUO_MEDIA_DISK', env('FILESYSTEM_DISK', 's3')),

];
