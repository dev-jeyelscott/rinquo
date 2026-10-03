<?php

namespace App\Support\Diagnostics;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Cache;

/**
 * Proves a queue worker (Horizon) picked up and processed a job by writing a
 * short-lived, uniquely keyed marker that the smoke command polls for.
 * Idempotent: running it twice writes the same marker.
 */
final class FoundationSmokeJob implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public const MARKER_TTL_SECONDS = 300;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(public readonly string $token) {}

    public static function markerKey(string $token): string
    {
        return 'foundation-smoke:queue:'.$token;
    }

    public function handle(): void
    {
        Cache::put(self::markerKey($this->token), true, self::MARKER_TTL_SECONDS);
    }
}
