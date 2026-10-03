<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

test('the application processes time in UTC', function () {
    expect(config('app.timezone'))->toBe('UTC')
        ->and(date_default_timezone_get())->toBe('UTC')
        ->and(now()->getTimezone()->getName())->toBe('UTC');
});

test('the PostgreSQL session uses UTC', function () {
    $timezone = DB::selectOne('show time zone');

    expect($timezone->TimeZone)->toBe('UTC');
});

test('Asia/Manila is exposed for display only', function () {
    expect(config('app.display_timezone'))->toBe('Asia/Manila');
});

test('a Manila wall-clock time converts to the correct UTC instant', function () {
    $manila = CarbonImmutable::parse('2026-01-15 09:30:00', config('app.display_timezone'));

    expect($manila->utc()->toIso8601ZuluString())->toBe('2026-01-15T01:30:00Z');
});

test('PostgreSQL stores the absolute instant regardless of the input offset', function () {
    $row = DB::selectOne(
        "select to_char(?::timestamptz at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') as utc",
        ['2026-01-15 09:30:00+08:00'],
    );

    expect($row->utc)->toBe('2026-01-15T01:30:00Z');
});
