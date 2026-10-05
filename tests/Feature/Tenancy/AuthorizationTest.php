<?php

use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use Tests\Support\Tenant;

/**
 * Every settings route, called directly (not through the UI), must reject Staff
 * (403), other tenants (404) and guests (login redirect) without changing data.
 *
 * @return list<array{0: string, 1: string, 2: array<string, mixed>}>
 */
function settingsRoutes(object $records, $organization): array
{
    return array_map(fn (array $row): array => $row + [3 => []], [
        ['get', 'owner.settings.profile', []],
        ['patch', 'owner.settings.profile.update', ['name' => 'Hacked']],
        ['post', 'owner.settings.media.store', []],
        ['get', 'owner.settings.hours', []],
        ['put', 'owner.settings.hours.update', ['weekly' => [], 'overrides' => []]],
        ['get', 'owner.settings.services', []],
        ['post', 'owner.settings.vehicle-types.store', ['name' => 'Hacked']],
        ['patch', 'owner.settings.vehicle-types.update', ['name' => 'Hacked'], ['vehicleType' => $records->vehicle->id]],
        ['post', 'owner.settings.vehicle-types.archive', [], ['vehicleType' => $records->vehicle->id]],
        ['post', 'owner.settings.services.store', ['name' => 'Hacked']],
        ['patch', 'owner.settings.services.update', ['name' => 'Hacked'], ['service' => $records->service->id]],
        ['post', 'owner.settings.services.archive', [], ['service' => $records->service->id]],
        ['put', 'owner.settings.services.windows', ['windows' => []], ['service' => $records->service->id]],
        ['post', 'owner.settings.variants.store', ['vehicle_type_id' => $records->vehicle->id, 'price_centavos' => 1, 'duration_minutes' => 1, 'buffer_minutes' => 0], ['service' => $records->service->id]],
        ['patch', 'owner.settings.variants.update', ['price_centavos' => 1, 'duration_minutes' => 1, 'buffer_minutes' => 0], ['service' => $records->service->id, 'variant' => $records->variant->id]],
        ['post', 'owner.settings.variants.archive', [], ['service' => $records->service->id, 'variant' => $records->variant->id]],
        ['put', 'owner.settings.variants.consumption', ['rules' => []], ['service' => $records->service->id, 'variant' => $records->variant->id]],
        ['post', 'owner.settings.add-ons.store', ['name' => 'Hacked']],
        ['get', 'owner.settings.resources', []],
        ['post', 'owner.settings.resource-types.store', ['name' => 'Hacked']],
        ['patch', 'owner.settings.resource-types.update', ['name' => 'Hacked'], ['resourceType' => $records->type->id]],
        ['post', 'owner.settings.resource-types.archive', [], ['resourceType' => $records->type->id]],
        ['post', 'owner.settings.resources.store', ['resource_type_id' => $records->type->id, 'name' => 'Hacked', 'capacity' => 9]],
        ['patch', 'owner.settings.resources.update', ['name' => 'Hacked', 'capacity' => 9], ['physicalResource' => $records->resource->id]],
        ['post', 'owner.settings.resources.archive', [], ['physicalResource' => $records->resource->id]],
        ['get', 'owner.settings.readiness', []],
        ['post', 'owner.settings.publish', []],
        ['post', 'owner.settings.unpublish', []],
    ]);
}

test('staff are forbidden on every owner-only route and nothing changes', function () {
    [, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);
    $staff = Tenant::user('staff@example.test');
    Membership::query()->create(['organization_id' => $organization->id, 'user_id' => $staff->id, 'role' => Membership::STAFF]);
    $audits = AuditEvent::query()->count();

    foreach (settingsRoutes($records, $organization) as [$method, $name, $payload, $extra]) {
        $url = route($name, ['organization' => $organization->id] + $extra);
        $this->actingAs($staff)->{$method}($url, $payload)->assertForbidden();
    }

    expect(AuditEvent::query()->count())->toBe($audits)
        ->and($organization->fresh()->name)->toBe('Shine')
        ->and($records->vehicle->fresh()->name)->toBe('Sedan');
});

test('another tenant owner gets not-found on every route, including nested ids', function () {
    [, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);
    [$intruder] = Tenant::organization('rival');

    foreach (settingsRoutes($records, $organization) as [$method, $name, $payload, $extra]) {
        $url = route($name, ['organization' => $organization->id] + $extra);
        $this->actingAs($intruder)->{$method}($url, $payload)->assertNotFound();
    }

    expect($records->vehicle->fresh()->name)->toBe('Sedan');
});

test('guests are redirected to sign in on every route', function () {
    [, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);

    foreach (settingsRoutes($records, $organization) as [$method, $name, $payload, $extra]) {
        $url = route($name, ['organization' => $organization->id] + $extra);
        $this->{$method}($url, $payload)->assertRedirect(route('owner.auth.login'));
    }
});

test('an inactive membership grants nothing', function () {
    [$owner, $organization] = Tenant::organization('shine');
    Membership::query()->where('user_id', $owner->id)->update(['is_active' => false]);

    $this->actingAs($owner)->get(route('owner.settings.profile', $organization))->assertNotFound();
});

test('child ids from another organization cannot be reached through your own organization', function () {
    [$owner, $organization] = Tenant::organization('shine');
    [, $rival] = Tenant::organization('rival');
    $rivalRecords = Tenant::makeReady($rival);

    $this->actingAs($owner)->patch(
        route('owner.settings.vehicle-types.update', ['organization' => $organization->id, 'vehicleType' => $rivalRecords->vehicle->id]),
        ['name' => 'Stolen'],
    )->assertNotFound();
    $this->actingAs($owner)->post(
        route('owner.settings.services.archive', ['organization' => $organization->id, 'service' => $rivalRecords->service->id]),
    )->assertNotFound();

    expect($rivalRecords->vehicle->fresh()->name)->toBe('Sedan')->and($rivalRecords->service->fresh()->archived_at)->toBeNull();
});
