<?php

use App\Modules\Booking\Actions\ConfirmBooking;
use App\Modules\Booking\Actions\PlaceHold;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Support\Shop;
use Tests\Support\Tenant;

/*
 * Real parallelism, not SQL-order assertions: N forked PHP processes, each on its
 * own PostgreSQL connection, wait on a file barrier and then race for the last
 * capacity. The parent asserts exactly one winner and, with an independent SQL
 * sweep, that no resource ever carries more load than its capacity.
 *
 * The suite wraps tests in a rolled-back transaction, which children could not
 * see, so this file commits its fixtures and truncates the tables afterwards.
 */

beforeEach(function () {
    if (! function_exists('pcntl_fork')) {
        $this->markTestSkipped('The pcntl extension is required for the real concurrency test.');
    }
    Mail::fake();
});

afterEach(function () {
    while (DB::transactionLevel() > 0) {
        DB::commit();
    }
    $tables = collect(DB::select("select tablename from pg_tables where schemaname = 'public' and tablename <> 'migrations'"))
        ->map(fn ($row) => '"'.$row->tablename.'"')->implode(', ');
    DB::statement("TRUNCATE {$tables} RESTART IDENTITY CASCADE");
});

/** Commits the fixtures so other connections can see them. */
function commitFixtures(): void
{
    while (DB::transactionLevel() > 0) {
        DB::commit();
    }
}

/**
 * Forks one child per callable, releases them together and returns their outcomes.
 *
 * @param  list<Closure>  $jobs  each returns a scalar describing its result and throws on failure
 * @return list<array{status: string, detail: string}>
 */
function race(array $jobs): array
{
    $dir = sys_get_temp_dir().'/rinquo-race-'.Str::random(8);
    mkdir($dir);
    $pids = [];

    foreach ($jobs as $index => $job) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('fork failed');
        }

        if ($pid === 0) {
            // Child: never touch the inherited connection (closing it would end the parent's session).
            try {
                config(["database.connections.child_{$index}" => config('database.connections.pgsql')]);
                DB::setDefaultConnection("child_{$index}");
                touch("{$dir}/ready.{$index}");
                $deadline = microtime(true) + 30;
                while (! file_exists("{$dir}/go") && microtime(true) < $deadline) {
                    usleep(500);
                }
                $result = ['status' => 'won', 'detail' => (string) $job()];
            } catch (ValidationException $exception) {
                $result = ['status' => 'rejected', 'detail' => json_encode($exception->errors())];
            } catch (Throwable $exception) {
                $result = ['status' => 'error', 'detail' => $exception::class.': '.$exception->getMessage()];
            }
            file_put_contents("{$dir}/result.{$index}", json_encode($result));
            // Skip shutdown handlers and destructors: they would close the shared socket.
            function_exists('posix_kill') ? posix_kill(posix_getpid(), SIGKILL) : exit(0);
        }

        $pids[] = $pid;
    }

    $deadline = microtime(true) + 30;
    while (count(glob("{$dir}/ready.*")) < count($jobs) && microtime(true) < $deadline) {
        usleep(1000);
    }
    touch("{$dir}/go");

    foreach ($pids as $pid) {
        pcntl_waitpid($pid, $status);
    }

    $results = [];
    foreach (array_keys($jobs) as $index) {
        $file = "{$dir}/result.{$index}";
        $results[] = file_exists($file) ? json_decode((string) file_get_contents($file), true) : ['status' => 'error', 'detail' => 'no result'];
        @unlink($file);
    }
    array_map('unlink', glob("{$dir}/*"));
    rmdir($dir);

    return $results;
}

/** Highest load per resource at any claim start, from an independent SQL sweep of the live claims. */
function peakLoads(): array
{
    return collect(DB::select(<<<'SQL'
        WITH claims AS (
            SELECT physical_resource_id AS r, scheduled_start_at AS s, occupied_end_at AS e, units AS u
              FROM booking_holds WHERE status = 'active' AND expires_at > ?
            UNION ALL
            SELECT physical_resource_id, scheduled_start_at, occupied_end_at, consumption_units
              FROM bookings WHERE status = 'confirmed' OR (status = 'pending_approval' AND pending_expires_at > ?)
        )
        SELECT p.r AS resource_id, MAX(p.load) AS peak FROM (
            SELECT points.r, points.s, SUM(c.u) AS load
              FROM (SELECT DISTINCT r, s FROM claims) points
              JOIN claims c ON c.r = points.r AND c.s <= points.s AND c.e > points.s
             GROUP BY points.r, points.s
        ) p GROUP BY p.r
        SQL, [now(), now()]))->pluck('peak', 'resource_id')->map(fn ($peak) => (int) $peak)->all();
}

function summarize(array $results): array
{
    $count = fn (string $status) => count(array_filter($results, fn ($result) => $result['status'] === $status));

    return ['won' => $count('won'), 'rejected' => $count('rejected'), 'error' => $count('error')];
}

test('parallel hold requests cannot both claim the last unit', function () {
    $shop = Shop::make(capacity: 1);
    commitFixtures();

    $jobs = array_map(fn (int $i) => function () use ($shop) {
        $hold = app(PlaceHold::class)->handle(
            $shop->organization,
            (string) Str::uuid(),
            $shop->records->vehicle->id,
            $shop->records->service->id,
            [],
            Shop::at('2026-10-06 10:00'),
            Str::random(40),
        );

        return $hold->public_id;
    }, range(1, 8));

    $results = race($jobs);

    expect(summarize($results))->toBe(['won' => 1, 'rejected' => 7, 'error' => 0]);
    expect(Hold::query()->where('status', 'active')->count())->toBe(1);
    foreach (peakLoads() as $resourceId => $peak) {
        expect($peak)->toBeLessThanOrEqual($shop->records->resource->capacity);
    }
});

test('parallel confirmations of competing expired holds produce exactly one booking', function () {
    $shop = Shop::make(capacity: 1);
    $holds = [];
    foreach (range(1, 6) as $i) {
        $customer = Tenant::user("racer{$i}@example.test");
        $token = Str::random(40);
        $hold = $shop->hold('2026-10-06 10:00', attributes: [
            'session_token_hash' => hash('sha256', $token),
            'status' => Hold::EXPIRED,
            'expires_at' => now()->subMinute(),
            'contact_name' => "Racer {$i}",
        ]);
        $holds[] = [$hold, $token, $customer];
    }
    commitFixtures();

    $jobs = array_map(fn (array $entry) => function () use ($shop, $entry) {
        [$hold, $token, $customer] = $entry;

        return app(ConfirmBooking::class)->handle($shop->organization, $hold->public_id, $token, $customer)->public_id;
    }, $holds);

    $results = race($jobs);

    expect(summarize($results))->toBe(['won' => 1, 'rejected' => 5, 'error' => 0]);
    expect(Booking::query()->count())->toBe(1);
    foreach (peakLoads() as $peak) {
        expect($peak)->toBeLessThanOrEqual(1);
    }
});

test('a temporary hold racing a confirm re-acquire leaves exactly one claim on the last unit', function () {
    $shop = Shop::make(capacity: 1);
    $confirmers = [];
    foreach (range(1, 3) as $i) {
        $customer = Tenant::user("confirmer{$i}@example.test");
        $token = Str::random(40);
        $hold = $shop->hold('2026-10-06 10:00', attributes: [
            'session_token_hash' => hash('sha256', $token),
            'status' => Hold::EXPIRED,
            'expires_at' => now()->subMinute(),
            'contact_name' => "Confirmer {$i}",
        ]);
        $confirmers[] = [$hold, $token, $customer];
    }
    commitFixtures();

    $jobs = [];
    foreach ($confirmers as $entry) {
        $jobs[] = function () use ($shop, $entry) {
            [$hold, $token, $customer] = $entry;

            return app(ConfirmBooking::class)->handle($shop->organization, $hold->public_id, $token, $customer)->public_id;
        };
    }
    foreach (range(1, 3) as $i) {
        $jobs[] = function () use ($shop) {
            return app(PlaceHold::class)->handle($shop->organization, (string) Str::uuid(), $shop->records->vehicle->id, $shop->records->service->id, [], Shop::at('2026-10-06 10:00'), Str::random(40))->public_id;
        };
    }

    $results = race($jobs);

    expect(summarize($results))->toBe(['won' => 1, 'rejected' => 5, 'error' => 0]);
    expect(Booking::query()->count() + Hold::query()->where('status', 'active')->count())->toBe(1);
    foreach (peakLoads() as $peak) {
        expect($peak)->toBeLessThanOrEqual(1);
    }
});

test('two units of capacity admit exactly two of many parallel holds', function () {
    $shop = Shop::make(capacity: 2);
    commitFixtures();

    $jobs = array_map(fn (int $i) => function () use ($shop) {
        return app(PlaceHold::class)->handle($shop->organization, (string) Str::uuid(), $shop->records->vehicle->id, $shop->records->service->id, [], Shop::at('2026-10-06 10:00'), Str::random(40))->public_id;
    }, range(1, 8));

    $results = race($jobs);

    expect(summarize($results))->toBe(['won' => 2, 'rejected' => 6, 'error' => 0]);
    foreach (peakLoads() as $peak) {
        expect($peak)->toBeLessThanOrEqual(2);
    }
});
