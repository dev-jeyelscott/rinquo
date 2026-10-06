<?php

namespace App\Modules\Subscription\PayMongo;

/**
 * Verifies the `Paymongo-Signature` header: `t=<unix>,te=<test hmac>,li=<live hmac>`
 * where the HMAC-SHA256 covers `<t>.<raw body>`. The signature field is chosen by
 * the configured mode, so a test-mode signature never authorizes a live endpoint.
 */
final class WebhookSignature
{
    public static function verify(string $rawBody, ?string $header, string $secret, string $mode, int $toleranceSeconds, ?int $now = null): bool
    {
        if ($header === null || $secret === '' || ! in_array($mode, ['test', 'live'], true)) {
            return false;
        }

        $parts = [];
        foreach (explode(',', $header) as $segment) {
            [$key, $value] = array_pad(explode('=', trim($segment), 2), 2, '');
            $parts[$key] = $value;
        }

        $timestamp = $parts['t'] ?? '';
        $signature = $parts[$mode === 'live' ? 'li' : 'te'] ?? '';

        if (! ctype_digit($timestamp) || $signature === '' || abs(($now ?? time()) - (int) $timestamp) > $toleranceSeconds) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $timestamp.'.'.$rawBody, $secret), $signature);
    }

    /** Builds a header (used by tests and local tooling). */
    public static function header(string $rawBody, string $secret, string $mode, ?int $timestamp = null): string
    {
        $timestamp ??= time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$rawBody, $secret);

        return $mode === 'live' ? "t=$timestamp,te=,li=$signature" : "t=$timestamp,te=$signature,li=";
    }
}
