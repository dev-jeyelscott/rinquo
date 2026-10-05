<?php

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Availability\Claim;
use App\Modules\Booking\Availability\ResourceFeasibility;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\ResourceType;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Tests\Support\Shop;
use Tests\Support\Tenant;

/** @return array{all: list<string>, available: list<string>, closed: bool} local H:i times on a local date */
function dayTimes(Shop $shop, string $date = '2026-10-06', array $addOns = []): array
{
    $day = app(AvailabilitySearch::class)->forDate(
        $shop->organization,
        $shop->organization->bookingPolicy()->firstOrFail(),
        $shop->records->variant,
        new Collection($addOns),
        CarbonImmutable::parse($date, 'Asia/Manila')->startOfDay(),
    );
    $local = fn (array $time): string => CarbonImmutable::parse($time['startAt'])->setTimezone('Asia/Manila')->format('H:i');

    return [
        'all' => array_map($local, $day->times),
        'available' => array_map($local, array_filter($day->times, fn (array $time): bool => $time['available'])),
        'closed' => $day->closed,
    ];
}

test('a slot with remaining capacity is available and a full one is not', function () {
    $shop = Shop::make(capacity: 2);
    $shop->hold('2026-10-06 10:00');

    expect(dayTimes($shop)['available'])->toContain('10:00');

    $shop->hold('2026-10-06 10:00');

    $times = dayTimes($shop);
    expect($times['available'])->not->toContain('10:00')->and($times['all'])->toContain('10:00');
});

test('capacity is never aggregated across resources', function () {
    $shop = Shop::make(capacity: 1, units: 2);
    $shop->resource('Bay 2', 1);

    // Two single-unit bays could "sum" to 2 units, but one claim must fit ONE resource.
    expect(dayTimes($shop)['available'])->toBe([]);
});

test('a variant that fits one larger resource is available', function () {
    $shop = Shop::make(capacity: 1, units: 2);
    $shop->resource('Big bay', 2);

    expect(dayTimes($shop)['available'])->toContain('09:00');
});

test('non-overlapping claims on one resource do not add up but a peak inside the span does', function () {
    $shop = Shop::make(capacity: 2);
    // Two claims touch the 10:00 span at different moments, never together.
    $shop->hold('2026-10-06 09:00', minutes: 70);   // 09:00-10:10
    $shop->hold('2026-10-06 10:30', minutes: 70);   // 10:30-11:40
    expect(dayTimes($shop)['available'])->toContain('10:00');

    // A third claim that overlaps one of them makes the peak 2 inside a long span.
    $peak = Shop::make('peaky', capacity: 2);
    $peak->hold('2026-10-06 09:00', minutes: 120); // 09:00-11:00
    $peak->hold('2026-10-06 10:00', minutes: 60);  // 10:00-11:00
    $times = dayTimes($peak);
    expect($times['available'])->not->toContain('09:45')   // span 09:45-10:55 hits the 2-unit peak
        ->and($times['available'])->toContain('11:00');
});

test('the sweep finds the peak between two claims that never touch the span edges', function () {
    $claims = [
        new Claim(Shop::at('2026-10-06 10:00'), Shop::at('2026-10-06 11:00'), 1),
        new Claim(Shop::at('2026-10-06 10:30'), Shop::at('2026-10-06 11:30'), 1),
    ];

    expect(ResourceFeasibility::peak(Shop::at('2026-10-06 09:00'), Shop::at('2026-10-06 12:00'), $claims))->toBe(2)
        ->and(ResourceFeasibility::fits(2, 1, Shop::at('2026-10-06 09:00'), Shop::at('2026-10-06 12:00'), $claims))->toBeFalse()
        ->and(ResourceFeasibility::fits(3, 1, Shop::at('2026-10-06 09:00'), Shop::at('2026-10-06 12:00'), $claims))->toBeTrue()
        ->and(ResourceFeasibility::fits(2, 1, Shop::at('2026-10-06 11:00'), Shop::at('2026-10-06 12:00'), $claims))->toBeTrue();
});

test('a buffer overlap blocks the next start', function () {
    $shop = Shop::make(capacity: 1);
    $shop->hold('2026-10-06 10:00', minutes: 70); // service 10:00-11:00 plus 10 minute buffer

    $available = dayTimes($shop)['available'];
    expect($available)->not->toContain('10:45')->and($available)->not->toContain('11:00')
        ->and($available)->toContain('11:15');
});

test('add-on duration extends the span', function () {
    $shop = Shop::make(capacity: 1);
    $wax = $shop->addOn(minutes: 30);
    $shop->hold('2026-10-06 11:00', minutes: 70);

    // Without the add-on 09:45-10:45(+10) ends before 11:00; with 30 more minutes it collides.
    expect(dayTimes($shop)['available'])->toContain('09:45')
        ->and(dayTimes($shop, addOns: [$wax])['available'])->not->toContain('09:45')
        ->and(dayTimes($shop, addOns: [$wax])['available'])->not->toContain('09:30')
        ->and(dayTimes($shop, addOns: [$wax])['available'])->toContain('09:15');
});

test('the service span must fit inside the window and opening hours but the buffer may pass closing', function () {
    $shop = Shop::make(capacity: 2);
    $times = dayTimes($shop)['all'];

    // Window 09:00-17:00 inside hours 08:00-18:00: the last 60 minute start is 16:00 and its 10 minute buffer runs to 17:10.
    expect($times[0])->toBe('09:00')->and(end($times))->toBe('16:00');

    // Hours 12:00-14:00 on one date clip the window: the last start is 13:00 and the buffer passes closing.
    $branch = $shop->organization->branch()->firstOrFail();
    Tenant::make(BranchDateOverride::class, ['organization_id' => $shop->organization->id, 'branch_id' => $branch->id, 'local_date' => '2026-10-06', 'is_closed' => false, 'opens_at' => '12:00', 'closes_at' => '14:00']);
    expect(dayTimes($shop, '2026-10-06')['all'])->toBe(['12:00', '12:15', '12:30', '12:45', '13:00']);
});

test('a date override replaces that date\'s hours and can close the day', function () {
    $shop = Shop::make(capacity: 2);
    $branch = $shop->organization->branch()->firstOrFail();

    Tenant::make(BranchDateOverride::class, ['organization_id' => $shop->organization->id, 'branch_id' => $branch->id, 'local_date' => '2026-10-06', 'is_closed' => true]);
    Tenant::make(BranchDateOverride::class, ['organization_id' => $shop->organization->id, 'branch_id' => $branch->id, 'local_date' => '2026-10-07', 'is_closed' => false, 'opens_at' => '12:00', 'closes_at' => '14:00']);

    $closed = dayTimes($shop, '2026-10-06');
    $short = dayTimes($shop, '2026-10-07');

    expect($closed['closed'])->toBeTrue()->and($closed['all'])->toBe([])
        ->and($short['closed'])->toBeFalse()->and($short['all'])->toBe(['12:00', '12:15', '12:30', '12:45', '13:00']);
});

test('starts sit on the grid of every allowed interval', function (int $interval) {
    $shop = Shop::make(capacity: 2)->policy(['slot_interval_minutes' => $interval]);
    $times = dayTimes($shop)['all'];

    expect($times)->not->toBeEmpty();
    foreach ($times as $time) {
        [$hours, $minutes] = array_map('intval', explode(':', $time));
        expect((($hours * 60) + $minutes) % $interval)->toBe(0);
    }
    expect($times[0])->toBe('09:00');
})->with([5, 10, 15, 20, 30, 60]);

test('minimum notice allows exactly the boundary and nothing earlier', function () {
    $shop = Shop::make(capacity: 2)->policy(['min_notice_minutes' => 90]);

    // now = 08:00, notice 90 minutes: 09:30 is allowed, 09:15 is not.
    $today = dayTimes($shop, '2026-10-05');
    expect($today['all'][0])->toBe('09:30');

    $shop->policy(['min_notice_minutes' => 60]);
    expect(dayTimes($shop, '2026-10-05')['all'][0])->toBe('09:00');
});

test('the booking horizon is inclusive of its last local date', function () {
    $shop = Shop::make(capacity: 2)->policy(['horizon_days' => 3]);

    expect(dayTimes($shop, '2026-10-08')['all'])->not->toBeEmpty()   // today + 3
        ->and(dayTimes($shop, '2026-10-09')['all'])->toBe([])
        ->and(dayTimes($shop, '2026-10-04')['all'])->toBe([]);
});

test('alternative resource types serve a time when the first is full', function () {
    $shop = Shop::make(capacity: 1);
    $second = Tenant::make(ResourceType::class, ['organization_id' => $shop->organization->id, 'branch_id' => $shop->organization->branch()->firstOrFail()->id, 'name' => 'Detail bay']);
    $other = $shop->resource('Detail 1', 1, $second->id);
    Tenant::make(CapacityConsumption::class, ['organization_id' => $shop->organization->id, 'service_vehicle_variant_id' => $shop->records->variant->id, 'resource_type_id' => $second->id, 'units' => 1]);

    $shop->hold('2026-10-06 10:00'); // fills the wash bay

    expect(dayTimes($shop)['available'])->toContain('10:00');

    $claim = app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant, new Collection, Shop::at('2026-10-06 10:00'));
    expect($claim->resource->id)->toBe($other->id);

    $shop->hold('2026-10-06 10:00', resource: $other);
    expect(dayTimes($shop)['available'])->not->toContain('10:00');
});

test('inactive and archived resources and resource types are excluded', function () {
    $shop = Shop::make(capacity: 1);
    $spare = $shop->resource('Bay 2', 1);

    $shop->hold('2026-10-06 10:00'); // Bay 1 busy
    expect(dayTimes($shop)['available'])->toContain('10:00');

    $spare->forceFill(['is_active' => false])->save();
    expect(dayTimes($shop)['available'])->not->toContain('10:00');

    $spare->forceFill(['is_active' => true, 'archived_at' => now()])->save();
    expect(dayTimes($shop)['available'])->not->toContain('10:00');
});

test('expired holds and expired pending requests no longer claim capacity', function () {
    $shop = Shop::make(capacity: 1);
    $shop->hold('2026-10-06 10:00', attributes: ['expires_at' => now()->addMinutes(5)]);
    $shop->booking('2026-10-06 12:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => now()->addMinutes(5)]);

    expect(dayTimes($shop)['available'])->not->toContain('10:00')->and(dayTimes($shop)['available'])->not->toContain('12:00');

    // Capacity frees at the expiry instant even though no sweeper ran.
    $this->travel(6)->minutes();
    expect(dayTimes($shop)['available'])->toContain('10:00')->and(dayTimes($shop)['available'])->toContain('12:00');
});

test('confirmed bookings and live pending requests claim capacity; declined and expired ones do not', function () {
    $shop = Shop::make(capacity: 1);
    $shop->booking('2026-10-06 09:00', Booking::CONFIRMED);
    $shop->booking('2026-10-06 11:00', Booking::PENDING_APPROVAL);
    $shop->booking('2026-10-06 13:00', Booking::DECLINED);
    $shop->booking('2026-10-06 15:00', Booking::EXPIRED);

    $available = dayTimes($shop)['available'];
    expect($available)->not->toContain('09:00')->and($available)->not->toContain('11:00')
        ->and($available)->toContain('13:00')->and($available)->toContain('15:00');
});

test('next available scans forward across days and returns null beyond the horizon', function () {
    $shop = Shop::make(capacity: 1)->policy(['horizon_days' => 2]);
    $search = app(AvailabilitySearch::class);
    $policy = $shop->organization->bookingPolicy()->firstOrFail();
    $next = fn () => $search->nextAvailable($shop->organization, $policy->fresh(), $shop->records->variant, new Collection);

    expect($next()->setTimezone('Asia/Manila')->format('Y-m-d H:i'))->toBe('2026-10-05 09:00');

    // Fill every start today with a long hold so the next free start is tomorrow.
    $shop->hold('2026-10-05 09:00', minutes: 600, attributes: ['expires_at' => now()->addDays(3)]);
    expect($next()->setTimezone('Asia/Manila')->format('Y-m-d H:i'))->toBe('2026-10-06 09:00');

    foreach (['2026-10-06', '2026-10-07'] as $date) {
        $shop->hold("{$date} 08:00", minutes: 600, attributes: ['expires_at' => now()->addDays(3)]);
    }
    expect($next())->toBeNull();
});

test('claims are scoped to their own organization', function () {
    $shop = Shop::make('shine', capacity: 1);
    $other = Shop::make('other', capacity: 1);
    $other->hold('2026-10-06 10:00');

    expect(dayTimes($shop)['available'])->toContain('10:00');
    expect(Hold::query()->where('organization_id', $shop->organization->id)->count())->toBe(0);
});
