<?php

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Models\AuditEvent;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

function owned(): array
{
    [$owner, $organization] = Tenant::organization('shine');

    return [$owner, $organization, fn (string $name, array $extra = []) => route($name, ['organization' => $organization->id] + $extra)];
}

test('an owner builds the whole operating model through the settings routes', function () {
    [$owner, $organization, $url] = owned();
    $this->actingAs($owner);

    $this->patch($url('owner.settings.profile.update'), [
        'name' => 'Shine Auto Spa', 'tagline' => 'Spotless', 'description' => 'Hand wash.', 'brand_color' => '#0E7490',
        'branch_name' => 'Main', 'address_line' => '1 Rizal Ave', 'city' => 'Manila', 'phone' => '+63 2 1234 5678',
    ])->assertSessionHasNoErrors();

    $weekly = collect(range(1, 6))->map(fn ($d) => ['weekday' => $d, 'opens_at' => '08:00', 'closes_at' => '17:00'])->all();
    $this->put($url('owner.settings.hours.update'), ['weekly' => $weekly, 'overrides' => [['local_date' => '2026-12-25', 'is_closed' => true]]])
        ->assertSessionHasNoErrors();

    $this->post($url('owner.settings.vehicle-types.store'), ['name' => 'Sedan'])->assertSessionHasNoErrors();
    $this->post($url('owner.settings.services.store'), ['name' => 'Full wash', 'description' => 'Inside and out'])->assertSessionHasNoErrors();
    $this->post($url('owner.settings.resource-types.store'), ['name' => 'Wash bay'])->assertSessionHasNoErrors();

    $type = ResourceType::query()->sole();
    $this->post($url('owner.settings.resources.store'), ['resource_type_id' => $type->id, 'name' => 'Bay 1', 'capacity' => 2])->assertSessionHasNoErrors();

    $service = Service::query()->sole();
    $vehicle = VehicleType::query()->sole();
    $this->post($url('owner.settings.variants.store', ['service' => $service->id]), [
        'vehicle_type_id' => $vehicle->id, 'price_centavos' => 35000, 'duration_minutes' => 60, 'buffer_minutes' => 10,
    ])->assertSessionHasNoErrors();
    $variant = ServiceVehicleVariant::query()->sole();

    $this->put($url('owner.settings.variants.consumption', ['service' => $service->id, 'variant' => $variant->id]), [
        'rules' => [['resource_type_id' => $type->id, 'units' => 1]],
    ])->assertSessionHasNoErrors();
    $this->put($url('owner.settings.services.windows', ['service' => $service->id]), [
        'windows' => [['weekday' => 1, 'starts_at' => '09:00', 'ends_at' => '12:00']],
    ])->assertSessionHasNoErrors();
    $this->post($url('owner.settings.add-ons.store'), [
        'name' => 'Wax', 'price_centavos' => 15000, 'duration_minutes' => 15,
        'service_ids' => [$service->id], 'vehicle_type_ids' => [$vehicle->id],
    ])->assertSessionHasNoErrors();

    expect(BranchWeeklyHour::query()->count())->toBe(6)
        ->and(BranchDateOverride::query()->sole()->is_closed)->toBeTrue()
        ->and(CapacityConsumption::query()->sole()->units)->toBe(1)
        ->and(ServiceWindow::query()->count())->toBe(1)
        ->and(AddOn::query()->sole()->services()->count())->toBe(1);

    // Every record is organization-scoped.
    foreach ([VehicleType::class, Service::class, ResourceType::class, PhysicalResource::class, ServiceVehicleVariant::class, AddOn::class, CapacityConsumption::class, ServiceWindow::class] as $model) {
        expect($model::query()->where('organization_id', '!=', $organization->id)->count())->toBe(0);
    }

    $this->withoutVite()->get($url('owner.settings.readiness'))
        ->assertInertia(fn (Assert $page) => $page->component('owner/settings/readiness')->where('readiness.isReady', true));
});

test('every mutation appends an audit event with allowlisted values only', function () {
    [$owner, $organization, $url] = owned();
    $this->actingAs($owner)->post($url('owner.settings.vehicle-types.store'), ['name' => 'Sedan', 'password' => 'leak', 'extra' => 'x']);

    $vehicle = VehicleType::query()->sole();
    $this->patch($url('owner.settings.vehicle-types.update', ['vehicleType' => $vehicle->id]), ['name' => 'Saloon']);
    $this->patch($url('owner.settings.vehicle-types.update', ['vehicleType' => $vehicle->id]), ['name' => 'Saloon', 'is_active' => false]);
    $this->post($url('owner.settings.vehicle-types.archive', ['vehicleType' => $vehicle->id]));

    $events = AuditEvent::query()->where('subject_type', 'vehicle_type')->orderBy('id')->get();

    expect($events->pluck('action')->all())->toBe(['vehicle_type.created', 'vehicle_type.updated', 'vehicle_type.deactivated', 'vehicle_type.archived'])
        ->and($events->every(fn ($e) => $e->organization_id === $organization->id && $e->actor_user_id === $owner->id && $e->subject_id === $vehicle->id))->toBeTrue()
        ->and($events[0]->after)->toBe(['name' => 'Sedan', 'is_active' => true])
        ->and($events[1]->before)->toBe(['name' => 'Sedan', 'is_active' => true])
        ->and(json_encode($events->toArray()))->not->toContain('leak');
});

test('an audit event is rolled back together with a failed mutation', function () {
    [$owner, , $url] = owned();
    $before = AuditEvent::query()->count();

    $this->actingAs($owner)->post($url('owner.settings.vehicle-types.store'), ['name' => str_repeat('x', 200)])->assertSessionHasErrors('name');

    expect(AuditEvent::query()->count())->toBe($before)->and(VehicleType::query()->count())->toBe(0);
});

test('records are archived and keep their ids, never deleted', function () {
    [$owner, , $url] = owned();
    $this->actingAs($owner)->post($url('owner.settings.services.store'), ['name' => 'Full wash']);
    $service = Service::query()->sole();

    $this->post($url('owner.settings.services.archive', ['service' => $service->id]))->assertSessionHasNoErrors();
    $this->post($url('owner.settings.services.archive', ['service' => $service->id]))->assertSessionHasNoErrors(); // idempotent

    expect(Service::query()->sole()->only(['id', 'is_active']))->toBe(['id' => $service->id, 'is_active' => false])
        ->and(Service::query()->sole()->archived_at)->not->toBeNull()
        ->and(AuditEvent::query()->where('action', 'service.archived')->count())->toBe(1);

    $this->patch($url('owner.settings.services.update', ['service' => $service->id]), ['name' => 'Renamed'])->assertSessionHasErrors('record');

    // The name can be reused once archived.
    $this->post($url('owner.settings.services.store'), ['name' => 'Full wash'])->assertSessionHasNoErrors();
    expect(Service::query()->count())->toBe(2);
});

test('there is no delete route for catalog records', function () {
    [$owner, $organization] = owned();
    $service = Tenant::make(Service::class, ['organization_id' => $organization->id, 'name' => 'Wash']);

    $this->actingAs($owner)->delete("/owner/organizations/{$organization->id}/settings/services/{$service->id}")->assertStatus(405);
    expect(Service::query()->count())->toBe(1);
});

test('names are unique per organization case-insensitively but not across tenants', function () {
    [$owner, , $url] = owned();
    [, $rival] = Tenant::organization('rival');
    Tenant::make(VehicleType::class, ['organization_id' => $rival->id, 'name' => 'Sedan']);

    $this->actingAs($owner)->post($url('owner.settings.vehicle-types.store'), ['name' => 'Sedan'])->assertSessionHasNoErrors();
    $this->post($url('owner.settings.vehicle-types.store'), ['name' => 'sEDAN'])->assertSessionHasErrors('name');
});

test('hours validation', function (array $weekly, array $overrides, string $errorKey) {
    [$owner, , $url] = owned();

    $this->actingAs($owner)->put($url('owner.settings.hours.update'), ['weekly' => $weekly, 'overrides' => $overrides])->assertSessionHasErrors($errorKey);
    expect(BranchWeeklyHour::query()->count())->toBe(0);
})->with([
    'start after end' => [[['weekday' => 1, 'opens_at' => '18:00', 'closes_at' => '09:00']], [], 'weekly.0.closes_at'],
    'zero length' => [[['weekday' => 1, 'opens_at' => '09:00', 'closes_at' => '09:00']], [], 'weekly.0.closes_at'],
    'bad weekday' => [[['weekday' => 8, 'opens_at' => '09:00', 'closes_at' => '10:00']], [], 'weekly.0.weekday'],
    'bad time' => [[['weekday' => 1, 'opens_at' => '9am', 'closes_at' => '10:00']], [], 'weekly.0.opens_at'],
    'overlap' => [[['weekday' => 1, 'opens_at' => '09:00', 'closes_at' => '12:00'], ['weekday' => 1, 'opens_at' => '11:00', 'closes_at' => '14:00']], [], 'weekly'],
    'closed with times' => [[], [['local_date' => '2026-12-25', 'is_closed' => true, 'opens_at' => '09:00', 'closes_at' => '10:00']], 'overrides.0.opens_at'],
    'open without times' => [[], [['local_date' => '2026-12-25', 'is_closed' => false]], 'overrides.0.opens_at'],
    'duplicate date' => [[], [['local_date' => '2026-12-25', 'is_closed' => true], ['local_date' => '2026-12-25', 'is_closed' => true]], 'overrides.0.local_date'],
]);

test('adjacent opening intervals on one day and several intervals are accepted and replaced wholesale', function () {
    [$owner, , $url] = owned();
    $this->actingAs($owner);

    $this->put($url('owner.settings.hours.update'), ['weekly' => [
        ['weekday' => 1, 'opens_at' => '08:00', 'closes_at' => '12:00'],
        ['weekday' => 1, 'opens_at' => '12:00', 'closes_at' => '17:00'],
    ], 'overrides' => []])->assertSessionHasNoErrors();
    $this->put($url('owner.settings.hours.update'), ['weekly' => [['weekday' => 2, 'opens_at' => '08:00', 'closes_at' => '12:00']], 'overrides' => []]);

    expect(BranchWeeklyHour::query()->pluck('weekday')->all())->toBe([2])
        ->and(AuditEvent::query()->where('action', 'branch.hours_replaced')->count())->toBe(2);
});

test('variant, resource and add-on numbers are validated as positive integers', function (string $route, array $payload, string $field) {
    [$owner, $organization, $url] = owned();
    $records = Tenant::makeReady($organization);
    $payload = json_decode(str_replace(['__type__', '__vehicle__'], [$records->type->id, $records->vehicle->id], json_encode($payload)), true);

    $this->actingAs($owner)->post($url($route, ['service' => $records->service->id]), $payload)->assertSessionHasErrors($field);
})->with([
    'zero capacity' => ['owner.settings.resources.store', ['resource_type_id' => '__type__', 'name' => 'B', 'capacity' => 0], 'capacity'],
    'negative capacity' => ['owner.settings.resources.store', ['resource_type_id' => '__type__', 'name' => 'B', 'capacity' => -1], 'capacity'],
    'fractional capacity' => ['owner.settings.resources.store', ['resource_type_id' => '__type__', 'name' => 'B', 'capacity' => 1.5], 'capacity'],
    'zero duration' => ['owner.settings.variants.store', ['vehicle_type_id' => '__vehicle__', 'price_centavos' => 100, 'duration_minutes' => 0, 'buffer_minutes' => 0], 'duration_minutes'],
    'negative price' => ['owner.settings.variants.store', ['vehicle_type_id' => '__vehicle__', 'price_centavos' => -1, 'duration_minutes' => 30, 'buffer_minutes' => 0], 'price_centavos'],
    'decimal price' => ['owner.settings.variants.store', ['vehicle_type_id' => '__vehicle__', 'price_centavos' => 10.5, 'duration_minutes' => 30, 'buffer_minutes' => 0], 'price_centavos'],
    'negative buffer' => ['owner.settings.variants.store', ['vehicle_type_id' => '__vehicle__', 'price_centavos' => 100, 'duration_minutes' => 30, 'buffer_minutes' => -5], 'buffer_minutes'],
]);

test('a service cannot have two variants for the same vehicle type', function () {
    [$owner, $organization, $url] = owned();
    $records = Tenant::makeReady($organization);

    $this->actingAs($owner)->post($url('owner.settings.variants.store', ['service' => $records->service->id]), [
        'vehicle_type_id' => $records->vehicle->id, 'price_centavos' => 100, 'duration_minutes' => 30, 'buffer_minutes' => 0,
    ])->assertSessionHasErrors('vehicle_type_id');
});

test('consumption must be positive, unique per resource type and within a single resource capacity', function () {
    [$owner, $organization, $url] = owned();
    $records = Tenant::makeReady($organization);
    $route = $url('owner.settings.variants.consumption', ['service' => $records->service->id, 'variant' => $records->variant->id]);
    $this->actingAs($owner);

    $this->put($route, ['rules' => [['resource_type_id' => $records->type->id, 'units' => 0]]])->assertSessionHasErrors('rules.0.units');
    $this->put($route, ['rules' => [['resource_type_id' => $records->type->id, 'units' => 3]]])->assertSessionHasErrors('rules.0.units');
    $this->put($route, ['rules' => [['resource_type_id' => $records->type->id, 'units' => 1], ['resource_type_id' => $records->type->id, 'units' => 1]]])
        ->assertSessionHasErrors('rules.0.resource_type_id');
    $this->put($route, ['rules' => [['resource_type_id' => $records->type->id, 'units' => 2]]])->assertSessionHasNoErrors(); // boundary

    expect(CapacityConsumption::query()->sole()->units)->toBe(2);
});

test('body ids that belong to another organization are rejected', function () {
    [$owner, $organization, $url] = owned();
    $records = Tenant::makeReady($organization);
    [, $rival] = Tenant::organization('rival');
    $rivalRecords = Tenant::makeReady($rival);
    $this->actingAs($owner);

    $this->post($url('owner.settings.variants.store', ['service' => $records->service->id]), [
        'vehicle_type_id' => $rivalRecords->vehicle->id, 'price_centavos' => 100, 'duration_minutes' => 30, 'buffer_minutes' => 0,
    ])->assertSessionHasErrors('vehicle_type_id');
    $this->post($url('owner.settings.resources.store'), ['resource_type_id' => $rivalRecords->type->id, 'name' => 'Sneaky', 'capacity' => 1])
        ->assertSessionHasErrors('resource_type_id');
    $this->put($url('owner.settings.variants.consumption', ['service' => $records->service->id, 'variant' => $records->variant->id]), [
        'rules' => [['resource_type_id' => $rivalRecords->type->id, 'units' => 1]],
    ])->assertSessionHasErrors('rules.0.resource_type_id');
    $this->post($url('owner.settings.add-ons.store'), [
        'name' => 'X', 'price_centavos' => 0, 'duration_minutes' => 0, 'service_ids' => [$rivalRecords->service->id], 'vehicle_type_ids' => [],
    ])->assertSessionHasErrors('service_ids.0');

    expect(PhysicalResource::query()->where('name', 'Sneaky')->count())->toBe(0);
});

test('the windows of a service cannot overlap', function () {
    [$owner, $organization, $url] = owned();
    $records = Tenant::makeReady($organization);

    $this->actingAs($owner)->put($url('owner.settings.services.windows', ['service' => $records->service->id]), ['windows' => [
        ['weekday' => 1, 'starts_at' => '09:00', 'ends_at' => '12:00'], ['weekday' => 1, 'starts_at' => '11:00', 'ends_at' => '13:00'],
    ]])->assertSessionHasErrors('windows');
});

test('PostgreSQL itself rejects impossible values and cross-tenant references', function () {
    [, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);
    [, $rival] = Tenant::organization('rival');
    $rivalRecords = Tenant::makeReady($rival);
    $now = now();

    $insert = fn (string $table, array $row) => fn () => DB::transaction(fn () => DB::table($table)->insert($row + ['created_at' => $now, 'updated_at' => $now]));

    expect($insert('physical_resources', ['organization_id' => $organization->id, 'resource_type_id' => $records->type->id, 'name' => 'Zero', 'capacity' => 0]))->toThrow(QueryException::class);
    expect($insert('capacity_consumptions', ['organization_id' => $organization->id, 'service_vehicle_variant_id' => $records->variant->id, 'resource_type_id' => $records->type->id, 'units' => 0]))->toThrow(QueryException::class);
    expect($insert('service_vehicle_variants', ['organization_id' => $organization->id, 'service_id' => $records->service->id, 'vehicle_type_id' => $records->vehicle->id, 'price_centavos' => 1, 'duration_minutes' => 0]))->toThrow(QueryException::class);
    expect($insert('branch_weekly_hours', ['organization_id' => $organization->id, 'branch_id' => $organization->branch->id, 'weekday' => 1, 'opens_at' => '10:00', 'closes_at' => '09:00']))->toThrow(QueryException::class);
    // A row owned by this organization pointing at the rival's resource type:
    expect($insert('physical_resources', ['organization_id' => $organization->id, 'resource_type_id' => $rivalRecords->type->id, 'name' => 'Cross', 'capacity' => 1]))->toThrow(QueryException::class);
    expect($insert('capacity_consumptions', ['organization_id' => $organization->id, 'service_vehicle_variant_id' => $rivalRecords->variant->id, 'resource_type_id' => $records->type->id, 'units' => 1]))->toThrow(QueryException::class);
});

test('timestamps are UTC instants and local hours stay wall-clock values', function () {
    [$owner, $organization, $url] = owned();
    $this->actingAs($owner)->put($url('owner.settings.hours.update'), ['weekly' => [['weekday' => 1, 'opens_at' => '08:00', 'closes_at' => '17:00']], 'overrides' => []]);

    $audit = AuditEvent::query()->latest('id')->first();
    $createdAt = DB::selectOne('select created_at, extract(timezone from created_at) as offset_seconds from organization_audit_events where id = ?', [$audit->id]);

    expect((int) $createdAt->offset_seconds)->toBe(0)
        ->and(BranchWeeklyHour::query()->sole()->opens_at)->toBe('08:00:00');
});
