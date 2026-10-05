<?php

use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use Illuminate\Support\Facades\DB;
use Tests\Support\Tenant;

function evaluate($organization): array
{
    $result = app(ReadinessEvaluator::class)->evaluate($organization->fresh());
    $items = collect($result->items)->pluck('passed', 'key')->all();

    return [$result, $items];
}

test('a brand new organization fails every check', function () {
    [, $organization] = Tenant::organization();

    [$result, $items] = evaluate($organization);

    expect($result->isReady())->toBeFalse()
        ->and($items)->toBe(['profile' => false, 'branch' => false, 'hours' => false, 'offering' => false]);
});

test('a complete configuration is ready and the variant is available', function () {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);

    [$result, $items] = evaluate($organization);

    expect($result->isReady())->toBeTrue()
        ->and($items)->each->toBeTrue()
        ->and($result->availableVariantIds())->toBe([$records->variant->id]);
});

test('missing consumption makes only that combination unavailable', function () {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);
    $suv = Tenant::make(VehicleType::class, ['organization_id' => $organization->id, 'name' => 'SUV']);
    $incomplete = Tenant::make(ServiceVehicleVariant::class, [
        'organization_id' => $organization->id, 'service_id' => $records->service->id, 'vehicle_type_id' => $suv->id,
        'price_centavos' => 50000, 'duration_minutes' => 90,
    ]);

    [$result] = evaluate($organization);
    $byId = collect($result->variants)->keyBy('variant_id');

    expect($result->isReady())->toBeTrue()
        ->and($byId[$records->variant->id]['available'])->toBeTrue()
        ->and($byId[$incomplete->id]['available'])->toBeFalse()
        ->and($byId[$incomplete->id]['reasons'])->toContain(ReadinessEvaluator::REASON_NO_CONSUMPTION);
});

test('without any consumption rule nothing is bookable and the offering check fails', function () {
    [, $organization] = Tenant::organization();
    Tenant::makeReady($organization);
    CapacityConsumption::query()->delete();

    [$result, $items] = evaluate($organization);

    expect($items['offering'])->toBeFalse()->and($result->isReady())->toBeFalse();
});

test('resource availability rules', function (string $scenario, string $reason) {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);

    match ($scenario) {
        'inactive resource' => $records->resource->forceFill(['is_active' => false])->save(),
        'archived resource' => $records->resource->forceFill(['archived_at' => now()])->save(),
        'undersized resource' => CapacityConsumption::query()->update(['units' => 3]),
        'inactive resource type' => $records->type->forceFill(['is_active' => false])->save(),
        'archived resource type' => $records->type->forceFill(['archived_at' => now()])->save(),
    };

    [$result] = evaluate($organization);

    expect($result->variants[0]['available'])->toBeFalse()
        ->and($result->variants[0]['reasons'])->toContain($reason)
        ->and($result->isReady())->toBeFalse();
})->with([
    ['inactive resource', ReadinessEvaluator::REASON_NO_CAPACITY],
    ['archived resource', ReadinessEvaluator::REASON_NO_CAPACITY],
    ['undersized resource', ReadinessEvaluator::REASON_NO_CAPACITY],
    ['inactive resource type', ReadinessEvaluator::REASON_RESOURCE_TYPE_INACTIVE],
    ['archived resource type', ReadinessEvaluator::REASON_RESOURCE_TYPE_INACTIVE],
]);

test('capacity must fit in one resource, not be spread across several', function () {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);
    Tenant::make(PhysicalResource::class, [
        'organization_id' => $organization->id, 'resource_type_id' => $records->type->id, 'name' => 'Bay 2', 'capacity' => 2,
    ]);
    CapacityConsumption::query()->update(['units' => 3]); // 2 + 2 = 4 in total, but no single resource holds 3

    expect(evaluate($organization)[0]->isReady())->toBeFalse();

    CapacityConsumption::query()->update(['units' => 2]); // boundary: exactly the capacity
    expect(evaluate($organization)[0]->isReady())->toBeTrue();
});

test('catalog activity rules', function (string $scenario) {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);

    match ($scenario) {
        'inactive service' => $records->service->forceFill(['is_active' => false])->save(),
        'archived service' => $records->service->forceFill(['archived_at' => now()])->save(),
        'inactive vehicle type' => $records->vehicle->forceFill(['is_active' => false])->save(),
        'inactive variant' => $records->variant->forceFill(['is_active' => false])->save(),
        'archived variant' => $records->variant->forceFill(['archived_at' => now()])->save(),
    };

    expect(evaluate($organization)[0]->isReady())->toBeFalse();
})->with(['inactive service', 'archived service', 'inactive vehicle type', 'inactive variant', 'archived variant']);

test('a variant needs a service window that overlaps business hours for its duration', function (string $start, string $end, int $weekday, bool $ready) {
    [, $organization] = Tenant::organization();
    $records = Tenant::makeReady($organization);
    ServiceWindow::query()->delete();
    Tenant::make(ServiceWindow::class, [
        'organization_id' => $organization->id, 'service_id' => $records->service->id,
        'weekday' => $weekday, 'starts_at' => $start, 'ends_at' => $end,
    ]);

    expect(evaluate($organization)[0]->isReady())->toBe($ready);
})->with([
    'inside hours' => ['09:00', '12:00', 3, true],
    'exactly the duration' => ['17:00', '18:00', 3, true],
    'shorter than the duration' => ['17:30', '18:00', 3, false],
    'outside hours' => ['19:00', '21:00', 3, false],
    'touching only' => ['18:00', '20:00', 3, false],
    'window straddles closing but long enough' => ['16:30', '20:00', 3, true],
]);

test('no window or no business hours means not ready', function () {
    [, $organization] = Tenant::organization();
    Tenant::makeReady($organization);

    ServiceWindow::query()->delete();
    expect(evaluate($organization)[0]->isReady())->toBeFalse();

    Tenant::make(ServiceWindow::class, ['organization_id' => $organization->id, 'service_id' => Service::query()->value('id'), 'weekday' => 1, 'starts_at' => '09:00', 'ends_at' => '10:00']);
    BranchWeeklyHour::query()->delete();
    [$result, $items] = evaluate($organization);

    expect($items['hours'])->toBeFalse()->and($result->isReady())->toBeFalse();
});

test('profile and branch details are required', function (string $column, string $table, string $item) {
    [, $organization] = Tenant::organization();
    Tenant::makeReady($organization);
    DB::table($table)->update([$column => null]);

    expect(evaluate($organization)[1][$item])->toBeFalse();
})->with([
    ['tagline', 'organizations', 'profile'],
    ['description', 'organizations', 'profile'],
    ['address_line', 'branches', 'branch'],
    ['city', 'branches', 'branch'],
]);

test('another tenant s resources never satisfy this tenant s readiness', function () {
    [, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);
    [, $rival] = Tenant::organization('rival');
    Tenant::makeReady($rival);
    $records->resource->forceFill(['is_active' => false])->save();

    expect(evaluate($organization)[0]->isReady())->toBeFalse()->and(evaluate($rival)[0]->isReady())->toBeTrue();
});
