<?php

use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Models\AuditEvent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

function readyOwner(): array
{
    [$owner, $organization] = Tenant::organization('shine');
    $records = Tenant::makeReady($organization);

    return [$owner, $organization, $records];
}

test('publishing an unready organization fails closed and names what is missing', function () {
    [$owner, $organization] = Tenant::organization('shine');

    $this->actingAs($owner)->post(route('owner.settings.publish', $organization))->assertSessionHasErrors('publish');

    expect(session('errors')->first('publish'))->toContain('Public profile')->toContain('Bookable service offering');

    expect($organization->fresh()->published_at)->toBeNull()
        ->and(AuditEvent::query()->where('action', 'organization.published')->count())->toBe(0);
});

test('a ready organization stays a draft until the owner explicitly publishes', function () {
    [$owner, $organization] = readyOwner();

    expect($organization->fresh()->published_at)->toBeNull();
    $this->get(route('shops.show', 'shine'))->assertNotFound();

    $this->actingAs($owner)->post(route('owner.settings.publish', $organization))->assertSessionHasNoErrors();

    expect($organization->fresh()->published_at)->not->toBeNull()
        ->and(AuditEvent::query()->where('action', 'organization.published')->count())->toBe(1);
});

test('publish and unpublish are idempotent', function () {
    [$owner, $organization] = readyOwner();
    $this->actingAs($owner);

    $this->post(route('owner.settings.publish', $organization));
    $firstPublishedAt = $organization->fresh()->published_at;
    $this->travel(5)->minutes();
    $this->post(route('owner.settings.publish', $organization))->assertSessionHasNoErrors();

    expect($organization->fresh()->published_at->equalTo($firstPublishedAt))->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'organization.published')->count())->toBe(1);

    $this->post(route('owner.settings.unpublish', $organization));
    $this->post(route('owner.settings.unpublish', $organization));

    expect($organization->fresh()->published_at)->toBeNull()
        ->and(AuditEvent::query()->where('action', 'organization.unpublished')->count())->toBe(1);
});

test('publish recomputes readiness on the server even when the page was loaded while ready', function () {
    [$owner, $organization, $records] = readyOwner();
    $this->actingAs($owner)->withoutVite()->get(route('owner.settings.readiness', $organization))
        ->assertInertia(fn (Assert $page) => $page
            ->where('readiness.isReady', true)
            ->where('organization.branchName', 'Main branch'));

    // Capacity is lost after the page was rendered; the forged/stale publish must fail.
    $records->resource->forceFill(['is_active' => false])->save();

    $this->post(route('owner.settings.publish', $organization))->assertSessionHasErrors('publish');
    expect($organization->fresh()->published_at)->toBeNull();
});

test('publish locks the organization row before it recomputes readiness', function () {
    [$owner, $organization] = readyOwner();
    $statements = [];
    DB::listen(function ($query) use (&$statements) {
        $statements[] = strtolower($query->sql);
    });

    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));

    $lock = collect($statements)->search(fn ($sql) => str_contains($sql, 'from "organizations"') && str_contains($sql, 'for update'));
    $readiness = collect($statements)->search(fn ($sql) => str_contains($sql, 'from "branch_weekly_hours"'));
    $publish = collect($statements)->search(fn ($sql) => str_contains($sql, 'update "organizations"'));

    expect($lock)->not->toBeFalse()->and($lock)->toBeLessThan($readiness)->and($readiness)->toBeLessThan($publish);
});

test('a readiness-breaking change atomically unpublishes, and repairing it never republishes', function () {
    [$owner, $organization, $records] = readyOwner();
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));
    expect($organization->fresh()->published_at)->not->toBeNull();

    $this->patch(route('owner.settings.resources.update', ['organization' => $organization->id, 'physicalResource' => $records->resource->id]), [
        'name' => 'Bay 1', 'capacity' => 2, 'is_active' => false,
    ])->assertSessionHasNoErrors();

    expect($organization->fresh()->published_at)->toBeNull()
        ->and(AuditEvent::query()->where('action', 'organization.unpublished_automatically')->count())->toBe(1);
    $this->get(route('shops.show', 'shine'))->assertNotFound();

    $this->patch(route('owner.settings.resources.update', ['organization' => $organization->id, 'physicalResource' => $records->resource->id]), [
        'name' => 'Bay 1', 'capacity' => 2, 'is_active' => true,
    ]);

    expect($organization->fresh()->published_at)->toBeNull();
    $this->get(route('shops.show', 'shine'))->assertNotFound();
});

test('changes that keep the shop ready leave it published', function () {
    [$owner, $organization, $records] = readyOwner();
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));

    $this->patch(route('owner.settings.resources.update', ['organization' => $organization->id, 'physicalResource' => $records->resource->id]), ['name' => 'Bay One', 'capacity' => 3]);

    expect($organization->fresh()->published_at)->not->toBeNull();
});

test('clearing a required profile field on a published shop unpublishes it', function () {
    [$owner, $organization] = readyOwner();
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));

    $this->patch(route('owner.settings.profile.update', $organization), [
        'name' => 'Shine', 'tagline' => 'Ok', 'description' => 'Ok', 'brand_color' => '#112233',
        'branch_name' => 'Main', 'address_line' => '1 Rizal Ave', 'city' => '',
    ])->assertSessionHasErrors('city');

    expect($organization->fresh()->published_at)->not->toBeNull(); // rejected input changes nothing
});

test('the public storefront shows only active, complete variants and no scheduler internals', function () {
    [$owner, $organization, $records] = readyOwner();
    $suv = Tenant::make(VehicleType::class, ['organization_id' => $organization->id, 'name' => 'SUV']);
    Tenant::make(ServiceVehicleVariant::class, [
        'organization_id' => $organization->id, 'service_id' => $records->service->id, 'vehicle_type_id' => $suv->id,
        'price_centavos' => 9999, 'duration_minutes' => 30, // no consumption: unavailable
    ]);
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));
    auth()->logout();

    $response = $this->withoutVite()->get(route('shops.show', 'shine'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('shops/show')
            ->where('shop.name', 'Shine')
            ->where('shop.brandColor', '#1E40AF')
            ->where('bookingAvailable', true)
            ->where('bookingUrl', '/shops/shine/book')
            ->has('services', 1)
            ->where('services.0.name', 'Full wash')
            ->where('services.0.fromPriceCentavos', 35000)
            ->has('services.0.variants', 1)
            ->where('services.0.variants.0.vehicleType', 'Sedan')
            ->where('services.0.variants.0.durationMinutes', 60)
            ->where('hours.weekly.0.day', 'Monday')
            ->where('hours.weekly.0.label', '8:00 AM - 6:00 PM'));

    $payload = json_encode($response->original->getData()['page']['props']);
    foreach (['Bay 1', 'Wash bay', 'capacity', 'units', 'consumption', 'audit', 'storage_key', 'organization_id', '9999'] as $secret) {
        expect($payload)->not->toContain($secret);
    }
});

test('draft, unknown and unready shops all return the same generic unavailable page', function () {
    [, $organization] = readyOwner();
    $organization->forceFill(['published_at' => now()])->save();
    $records = ServiceVehicleVariant::query()->first();
    $records->forceFill(['is_active' => false])->save(); // published flag set, but no longer ready

    $unready = $this->withoutVite()->get(route('shops.show', 'shine'));
    $unknown = $this->withoutVite()->get(route('shops.show', 'does-not-exist'));
    $organization->forceFill(['published_at' => null])->save();
    $draft = $this->withoutVite()->get(route('shops.show', 'shine'));

    foreach ([$unready, $unknown, $draft] as $response) {
        $response->assertNotFound()->assertInertia(fn (Assert $page) => $page->component('shops/unavailable')->missing('shop')->missing('services'));
        expect($response->getContent())->not->toContain('Full wash')->not->toContain('Shine');
    }
});

test('open and closed state follows branch-local hours in Asia/Manila', function () {
    [$owner, $organization] = readyOwner();
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));
    auth()->logout();

    // 01:30 UTC is 09:30 in Manila: inside 08:00-18:00.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 01:30:00', 'UTC'));
    $this->withoutVite()->get(route('shops.show', 'shine'))->assertInertia(fn (Assert $page) => $page->where('hours.openNow', true)->where('hours.today', '8:00 AM - 6:00 PM'));

    // 11:00 UTC is 19:00 in Manila: closed.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 11:00:00', 'UTC'));
    $this->withoutVite()->get(route('shops.show', 'shine'))->assertInertia(fn (Assert $page) => $page->where('hours.openNow', false));

    // A closed date override wins over weekly hours.
    Tenant::make(BranchDateOverride::class, [
        'organization_id' => $organization->id, 'branch_id' => $organization->branch->id, 'local_date' => '2026-10-05', 'is_closed' => true,
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 01:30:00', 'UTC'));
    $this->withoutVite()->get(route('shops.show', 'shine'))->assertInertia(fn (Assert $page) => $page->where('hours.openNow', false)->where('hours.today', 'Closed today'));
});

test('the publication instant is stored in UTC', function () {
    [$owner, $organization] = readyOwner();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 01:30:00', 'UTC'));
    $this->actingAs($owner)->post(route('owner.settings.publish', $organization));

    $raw = DB::selectOne('select published_at at time zone \'UTC\' as utc, extract(timezone from published_at) as offset_seconds from organizations where id = ?', [$organization->id]);

    expect(substr($raw->utc, 0, 19))->toBe('2026-10-05 01:30:00')->and((int) $raw->offset_seconds)->toBe(0);
    $this->withoutVite()->get(route('owner.settings.readiness', $organization))
        ->assertInertia(fn (Assert $page) => $page->where('organization.publishedAt', fn ($value) => str_starts_with($value, '2026-10-05T01:30:00')));
});
