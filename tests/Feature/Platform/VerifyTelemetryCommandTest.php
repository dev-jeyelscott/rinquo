<?php

use App\Modules\Platform\Console\VerifyTelemetryCommand;

test('telemetry verification refuses production', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->artisan('platform:verify-telemetry')->expectsOutputToContain('staging only')->assertFailed();
});

test('telemetry verification needs a DSN and says so', function () {
    app()->detectEnvironment(fn () => 'staging');
    config(['sentry.dsn' => null]);

    $this->artisan('platform:verify-telemetry')->expectsOutputToContain('SENTRY_LARAVEL_DSN is not set')->assertFailed();
});

test('the canary is a fake secret that the scrubber must remove', function () {
    expect(VerifyTelemetryCommand::CANARY)->toContain('canary-secret');
});
