<?php

use App\Modules\Booking\Models\Hold;
use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Scheduling\Models\BranchDateOverride;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

function wizardUrl(Shop $shop, array $query = []): string
{
    return route('bookings.wizard', ['slug' => $shop->organization->slug] + $query);
}

test('the wizard exposes the catalog without any scheduler internals', function () {
    $shop = Shop::make(capacity: 3, units: 2);
    $shop->addOn('Wax', 15000, 20);

    $response = $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('shops/book')
            ->has('catalog', 1)
            ->where('catalog.0.name', 'Sedan')
            ->where('catalog.0.services.0.name', 'Full wash')
            ->where('catalog.0.services.0.priceCentavos', 35000)
            ->where('catalog.0.services.0.durationMinutes', 60)
            ->missing('catalog.0.services.0.bufferMinutes')
            ->where('catalog.0.services.0.addOns.0.name', 'Wax')
            ->where('availability.date', '2026-10-06')
            ->where('availability.times.0.available', true)
            ->has('dates', 31)
            ->where('nextAvailable.startAt', Shop::at('2026-10-05 09:00')->toIso8601String()));

    $props = $response->original->getData()['page']['props'];
    expect(Journey::leaksInternals($props))->toBeFalse();
    expect(json_encode($props))->not->toContain('Bay 1')->not->toContain('Wash bay');
});

test('availability reflects capacity without revealing why a time is unavailable', function () {
    $shop = Shop::make(capacity: 1);
    $shop->hold('2026-10-06 10:00');

    $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertInertia(function (Assert $page) {
            $times = collect($page->toArray()['props']['availability']['times'])->keyBy('startAt');
            expect($times[Shop::at('2026-10-06 10:00')->toIso8601String()]['available'])->toBeFalse()
                ->and($times[Shop::at('2026-10-06 11:30')->toIso8601String()]['available'])->toBeTrue()
                ->and(array_keys($times->first()))->toBe(['startAt', 'available']);
        });
});

test('availability and the next start can be reloaded on their own', function () {
    $shop = Shop::make();
    $version = $this->withoutVite()->get(wizardUrl($shop))->original->getData()['page']['version'];

    $response = $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) $version,
        'X-Inertia-Partial-Component' => 'shops/book',
        'X-Inertia-Partial-Data' => 'availability,nextAvailable',
    ])->assertOk();

    $props = $response->json('props');
    expect($props)->toHaveKeys(['availability', 'nextAvailable'])->and($props)->not->toHaveKey('catalog');
});

test('a draft, unknown or unready shop has no wizard', function () {
    $shop = Shop::make();
    $this->get(route('bookings.wizard', 'nope'))->assertNotFound();

    $shop->organization->forceFill(['published_at' => null])->save();
    $this->get(wizardUrl($shop))->assertNotFound();

    $shop->organization->forceFill(['published_at' => now()])->save();
    $shop->records->resource->forceFill(['is_active' => false])->save();
    $this->get(wizardUrl($shop))->assertNotFound();
});

test('ids that are not available in this shop are validation errors', function () {
    $shop = Shop::make('shine');
    $other = Shop::make('other');

    $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $other->records->vehicle->id, 'service' => $other->records->service->id]))
        ->assertSessionHasErrors('service_id');

    $this->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'addOns' => [999999]]))
        ->assertSessionHasErrors('add_on_ids');

    $this->get(wizardUrl($shop, ['date' => '2026-12-31']))->assertSessionHasErrors('date');
    $this->get(wizardUrl($shop, ['date' => 'tomorrow']))->assertSessionHasErrors('date');
});

test('a variant that is not ready cannot be offered', function () {
    $shop = Shop::make();
    $shop->records->variant->forceFill(['is_active' => false])->save();

    $this->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id]))
        ->assertNotFound(); // no available variant left, so the shop is no longer ready
});

test('a shop with a closed day marks it closed in the date strip', function () {
    $shop = Shop::make();
    $branch = $shop->organization->branch()->firstOrFail();
    Tenant::make(BranchDateOverride::class, ['organization_id' => $shop->organization->id, 'branch_id' => $branch->id, 'local_date' => '2026-10-07', 'is_closed' => true]);

    $this->withoutVite()->get(wizardUrl($shop))->assertInertia(fn (Assert $page) => $page
        ->where('dates.2.date', '2026-10-07')->where('dates.2.closed', true)->where('dates.1.closed', false));
});

test('the session that holds a time still sees it, and overlapping starts, as available at capacity 1', function () {
    $shop = Shop::make(capacity: 1);
    Journey::hold($shop, '2026-10-06 10:00');

    $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertInertia(function (Assert $page) {
            $times = collect($page->toArray()['props']['availability']['times'])->keyBy('startAt');
            expect($times[Shop::at('2026-10-06 10:00')->toIso8601String()]['available'])->toBeTrue()
                ->and($times[Shop::at('2026-10-06 10:30')->toIso8601String()]['available'])->toBeTrue()
                ->and(array_keys($times->first()))->toBe(['startAt', 'available']);
        });

    // The replacement the wizard now offers is accepted by the server.
    Journey::placeHold($shop, '2026-10-06 10:00')->assertSessionHasNoErrors();
});

test('a different session still sees the held time as unavailable', function () {
    $shop = Shop::make(capacity: 1);
    Journey::hold($shop, '2026-10-06 10:00');
    $this->flushSession();

    $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertInertia(function (Assert $page) {
            $times = collect($page->toArray()['props']['availability']['times'])->keyBy('startAt');
            expect($times[Shop::at('2026-10-06 10:00')->toIso8601String()]['available'])->toBeFalse()
                ->and($times[Shop::at('2026-10-06 10:30')->toIso8601String()]['available'])->toBeFalse();
        });
});

test('the next available start ignores the own hold of the session but not another session', function () {
    $shop = Shop::make(capacity: 1);
    $query = ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id];
    $first = Shop::at('2026-10-05 09:00')->toIso8601String();

    $shop->hold('2026-10-05 09:00');
    $this->withoutVite()->get(wizardUrl($shop, $query))
        ->assertInertia(fn (Assert $page) => $page->where('nextAvailable.startAt', fn ($v) => $v !== $first));

    Hold::query()->delete();
    Journey::hold($shop, '2026-10-05 09:00');
    $this->withoutVite()->get(wizardUrl($shop, $query))
        ->assertInertia(fn (Assert $page) => $page->where('nextAvailable.startAt', $first));
});

test('the own booking of the session still occupies capacity in availability', function () {
    $shop = Shop::make(capacity: 1);
    $hold = Journey::hold($shop, '2026-10-06 10:00');
    $hold->forceFill(['status' => 'converted'])->save();
    $shop->booking('2026-10-06 10:00');

    $this->withoutVite()->get(wizardUrl($shop, ['vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertInertia(function (Assert $page) {
            $times = collect($page->toArray()['props']['availability']['times'])->keyBy('startAt');
            expect($times[Shop::at('2026-10-06 10:00')->toIso8601String()]['available'])->toBeFalse();
        });
});

test('only the signed-in customer\'s active vehicles are offered on the Vehicle step', function () {
    $shop = Shop::make();
    $customer = Tenant::user('known@example.test');
    $other = Tenant::user('other@example.test');
    CustomerVehicle::query()->create(['user_id' => $customer->id, 'make_model' => 'Honda City', 'plate' => 'RIN-007']);
    CustomerVehicle::query()->create(['user_id' => $customer->id, 'make_model' => 'Old', 'plate' => 'OLD-1', 'archived_at' => now()]);
    CustomerVehicle::query()->create(['user_id' => $other->id, 'make_model' => 'Mazda 3', 'plate' => 'OTH-1']);

    $this->withoutVite()->get(route('bookings.wizard', 'shine'))
        ->assertInertia(fn (Assert $page) => $page->where('savedVehicles', []));

    $this->actingAs($customer)->withoutVite()->get(route('bookings.wizard', 'shine'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('savedVehicles', 1)
            ->where('savedVehicles.0.makeModel', 'Honda City')
            ->where('savedVehicles.0.plate', 'RIN-007'));
});

test('the wizard offers back the make and model this browser session typed for its last hold', function () {
    $shop = Shop::make();

    $this->withoutVite()->get(route('bookings.wizard', 'shine'))
        ->assertInertia(fn (Assert $page) => $page->where('selection.makeModel', null));

    Journey::placeHold($shop)->assertSessionHasNoErrors();

    $this->withoutVite()->get(route('bookings.wizard', 'shine'))
        ->assertInertia(fn (Assert $page) => $page->where('selection.makeModel', 'Toyota Vios'));

    $this->flushSession();
    $this->withoutVite()->get(route('bookings.wizard', 'shine'))
        ->assertInertia(fn (Assert $page) => $page->where('selection.makeModel', null));
});
