<?php

namespace App\Support\Environment;

use Illuminate\Contracts\Config\Repository;
use RuntimeException;

/**
 * Fails fast when a deployed environment is missing configuration that the
 * application cannot run without. Reads config (not env()) so it also works
 * with a cached configuration, and reports key names only, never values.
 */
final class RequiredEnvironment
{
    /**
     * @var list<string>
     */
    private const REQUIRED_KEYS = [
        'app.key',
        'app.url',
        'database.connections.pgsql.host',
        'database.connections.pgsql.database',
        'database.connections.pgsql.username',
        'database.redis.default.host',
        'filesystems.disks.s3.bucket',
        'filesystems.disks.s3.region',
        'filesystems.disks.s3.key',
        'mail.default',
        'broadcasting.connections.reverb.app_id',
        'broadcasting.connections.reverb.key',
        'broadcasting.connections.reverb.secret',
        'broadcasting.connections.reverb.options.host',
        'broadcasting.connections.reverb.browser.host',
    ];

    public function __construct(private readonly Repository $config) {}

    /**
     * @return list<string>
     */
    public function missing(): array
    {
        $required = self::REQUIRED_KEYS;

        if ($this->config->get('mail.default') === 'resend') {
            $required[] = 'services.resend.key';
        }

        return array_values(array_filter(
            $required,
            fn (string $key): bool => $this->isBlank($this->config->get($key)),
        ));
    }

    /**
     * @throws RuntimeException
     */
    public function assertPresent(): void
    {
        $missing = $this->missing();

        if ($missing !== []) {
            throw new RuntimeException(
                'Missing required configuration: '.implode(', ', $missing).'. '
                .'Set the corresponding environment variables (see docs/operations/environments.md).'
            );
        }
    }

    private function isBlank(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }
}
