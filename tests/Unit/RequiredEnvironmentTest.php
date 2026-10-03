<?php

use App\Support\Environment\RequiredEnvironment;
use Illuminate\Config\Repository;

function completeConfiguration(): array
{
    return [
        'app' => ['key' => 'base64:key', 'url' => 'https://rinquo.example'],
        'database' => [
            'connections' => ['pgsql' => ['host' => 'db.internal', 'database' => 'rinquo', 'username' => 'rinquo']],
            'redis' => ['default' => ['host' => 'redis.internal']],
        ],
        'filesystems' => ['disks' => ['s3' => ['bucket' => 'rinquo', 'region' => 'ap-southeast-1', 'key' => 'AKIA-VALUE']]],
        'mail' => ['default' => 'smtp'],
        'services' => ['resend' => ['key' => null]],
        'broadcasting' => ['connections' => ['reverb' => [
            'app_id' => 'id', 'key' => 'key', 'secret' => 'secret-value',
            'options' => ['host' => 'reverb'], 'browser' => ['host' => 'rinquo.example'],
        ]]],
    ];
}

test('complete configuration passes', function () {
    $required = new RequiredEnvironment(new Repository(completeConfiguration()));

    expect($required->missing())->toBe([]);
    $required->assertPresent();
});

test('missing values fail with key names only', function () {
    $config = new Repository(completeConfiguration());
    $config->set('app.key', '');
    $config->set('database.connections.pgsql.host', null);
    $config->set('filesystems.disks.s3.bucket', '   ');

    $required = new RequiredEnvironment($config);

    expect(fn () => $required->assertPresent())->toThrow(function (RuntimeException $exception) {
        expect($exception->getMessage())
            ->toContain('app.key', 'database.connections.pgsql.host', 'filesystems.disks.s3.bucket')
            ->not->toContain('secret-value')
            ->not->toContain('AKIA-VALUE')
            ->not->toContain('redis.internal');
    });
});

test('the Resend key is required only when Resend is the default mailer', function () {
    $config = new Repository(completeConfiguration());
    $config->set('mail.default', 'resend');

    expect((new RequiredEnvironment($config))->missing())->toBe(['services.resend.key']);

    $config->set('services.resend.key', 're_test_value');

    expect((new RequiredEnvironment($config))->missing())->toBe([]);
});
