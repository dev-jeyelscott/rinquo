<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

/**
 * Point a dependency at a host that cannot resolve, run the callback, and
 * always restore the real configuration afterwards.
 */
function withUnreachableDependency(string $configKey, Closure $reset, Closure $callback): void
{
    $original = config($configKey);
    config([$configKey => 'dependency.unreachable.invalid']);
    $reset();

    try {
        $callback();
    } finally {
        config([$configKey => $original]);
        $reset();
    }
}

function resetDatabase(): void
{
    DB::purge('pgsql');
}

function resetRedis(): void
{
    app()->forgetInstance('redis');
    Redis::clearResolvedInstances();
}

test('liveness endpoint responds when the application boots', function () {
    $this->get('/up')->assertOk();
});

test('readiness endpoint reports ok when PostgreSQL and Redis are reachable', function () {
    $this->getJson('/ready')
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertExactJson([
            'status' => 'ok',
            'checks' => ['database' => 'ok', 'redis' => 'ok'],
        ]);
});

test('readiness endpoint reports 503 without details when PostgreSQL is unreachable', function () {
    withUnreachableDependency('database.connections.pgsql.host', resetDatabase(...), function () {
        $response = $this->getJson('/ready');

        $response->assertStatus(503)->assertExactJson([
            'status' => 'fail',
            'checks' => ['database' => 'fail', 'redis' => 'ok'],
        ]);

        expect($response->getContent())
            ->not->toContain('unreachable')
            ->not->toContain('SQLSTATE')
            ->not->toContain('Exception');
    });
});

test('readiness endpoint reports 503 without details when Redis is unreachable', function () {
    withUnreachableDependency('database.redis.default.host', resetRedis(...), function () {
        $response = $this->getJson('/ready');

        $response->assertStatus(503)->assertExactJson([
            'status' => 'fail',
            'checks' => ['database' => 'ok', 'redis' => 'fail'],
        ]);

        expect($response->getContent())
            ->not->toContain('unreachable')
            ->not->toContain('Exception');
    });
});

test('readiness endpoint runs outside the session middleware', function () {
    $response = $this->getJson('/ready');

    expect($response->headers->getCookies())->toBeEmpty();
});
