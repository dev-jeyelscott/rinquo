<?php

namespace App\Modules\Platform\Console;

use Illuminate\Console\Command;

use function Sentry\captureException;

/**
 * Staging verification of backend error tracking. It sends one marked event whose message
 * contains a canary secret, through the same allowlist scrubber as real errors, so an operator
 * can confirm in Sentry that the event arrived in the right project, environment and release
 * and that the canary text did not. It refuses to run in production and never takes input.
 */
class VerifyTelemetryCommand extends Command
{
    public const CANARY = 'canary-secret-do-not-store@example.test';

    protected $signature = 'platform:verify-telemetry';

    protected $description = 'Send one marked, redaction-checkable error event to Sentry (staging only)';

    public function handle(): int
    {
        if ($this->laravel->environment('production')) {
            $this->components->error('Telemetry verification runs in staging only. Production is verified by the staging run of the same release.');

            return self::FAILURE;
        }

        if (config('sentry.dsn') === null) {
            $this->components->error('SENTRY_LARAVEL_DSN is not set for this environment.');

            return self::FAILURE;
        }

        $eventId = captureException(new TelemetryVerificationException('Verification event. '.self::CANARY));

        if ($eventId === null) {
            $this->components->error('The SDK did not accept the event. Check the DSN and that the scrubber did not drop it.');

            return self::FAILURE;
        }

        $this->components->info('Sent event '.$eventId.' (release '.(string) config('sentry.release').', environment '.(string) config('sentry.environment').').');
        $this->line('Confirm in the BACKEND Sentry project that it arrived with that release and environment, with the route/correlation_id tags, and that the text "canary-secret" appears nowhere on the event.');

        return self::SUCCESS;
    }
}
