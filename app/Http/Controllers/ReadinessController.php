<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Database\DatabaseManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Redis\RedisManager;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Readiness: can this instance serve requests right now?
 *
 * The body only ever says "ok" or "fail" per dependency. Failure details
 * (check, connection name, exception class) go to the log, never to the
 * response, so hosts and credentials are not exposed.
 */
final class ReadinessController
{
    /**
     * Redis connections the application depends on (queues/sessions and cache).
     *
     * @var list<string>
     */
    private const REDIS_CONNECTIONS = ['default', 'cache'];

    public function __invoke(DatabaseManager $database, RedisManager $redis): JsonResponse
    {
        $connection = $database->getDefaultConnection();

        $checks = [
            'database' => $this->probe('database', $connection, function () use ($database, $connection): void {
                $database->connection($connection)->select('select 1');
            }),
            'redis' => $this->redisStatus($redis),
        ];

        $ready = ! in_array('fail', $checks, true);

        return new JsonResponse(
            ['status' => $ready ? 'ok' : 'fail', 'checks' => $checks],
            $ready ? 200 : 503,
            ['Cache-Control' => 'no-store'],
        );
    }

    private function redisStatus(RedisManager $redis): string
    {
        foreach (self::REDIS_CONNECTIONS as $name) {
            $status = $this->probe('redis', $name, function () use ($redis, $name): void {
                $redis->connection($name)->ping();
            });

            if ($status === 'fail') {
                return 'fail';
            }
        }

        return 'ok';
    }

    /**
     * @param  Closure(): void  $probe
     */
    private function probe(string $check, string $connection, Closure $probe): string
    {
        try {
            $probe();

            return 'ok';
        } catch (Throwable $exception) {
            Log::warning('Readiness check failed.', [
                'check' => $check,
                'connection' => $connection,
                'exception' => $exception::class,
            ]);

            return 'fail';
        }
    }
}
