<?php

use App\Modules\Booking\Models\Hold;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;

beforeEach(function () {
    RateLimiter::clear('booking-holds');
});

test('continuing from Schedule holds the time on one resource for the configured window', function () {
    $shop = Shop::make();

    Journey::placeHold($shop)->assertSessionHasNoErrors();

    $hold = Hold::query()->sole();
    expect($hold->status)->toBe(Hold::ACTIVE)
        ->and($hold->physical_resource_id)->toBe($shop->records->resource->id)
        ->and($hold->units)->toBe(1)
        ->and($hold->scheduled_start_at->equalTo(Shop::at('2026-10-06 10:00')))->toBeTrue()
        ->and($hold->occupied_end_at->equalTo(Shop::at('2026-10-06 11:10')))->toBeTrue()
        ->and($hold->expires_at->equalTo(now()->addMinutes(15)))->toBeTrue()
        ->and($hold->public_id)->toBeUuid();
});

test('the hold TTL is configurable', function () {
    config(['rinquo.booking.hold_minutes' => 5]);
    $shop = Shop::make();
    Journey::placeHold($shop);

    expect(Hold::query()->sole()->expires_at->equalTo(now()->addMinutes(5)))->toBeTrue();
});

test('creating a hold is idempotent per key and a different payload under the same key is rejected', function () {
    $shop = Shop::make();
    $key = (string) Str::uuid();

    Journey::placeHold($shop, key: $key);
    Journey::placeHold($shop, key: $key)->assertSessionHasNoErrors();

    expect(Hold::query()->count())->toBe(1);

    Journey::placeHold($shop, '2026-10-06 11:00', key: $key)->assertSessionHasErrors('idempotency_key');
    expect(Hold::query()->count())->toBe(1);
});

test('a key replayed from another browser session is not honoured', function () {
    $shop = Shop::make();
    $key = (string) Str::uuid();

    Journey::placeHold($shop, key: $key);
    $this->flushSession();

    Journey::placeHold($shop, key: $key)->assertSessionHasErrors('idempotency_key');
});

test('one browser session keeps at most one active hold', function () {
    $shop = Shop::make();

    $first = Journey::hold($shop, '2026-10-06 10:00');
    $second = Journey::hold($shop, '2026-10-06 12:00');

    expect($first->fresh()->status)->toBe(Hold::RELEASED)
        ->and($second->fresh()->status)->toBe(Hold::ACTIVE)
        ->and(Hold::query()->where('status', Hold::ACTIVE)->count())->toBe(1);

    // The released time is free again for someone else.
    $this->flushSession();
    Journey::placeHold($shop, '2026-10-06 10:00')->assertSessionHasNoErrors();
});

test('the last unit of capacity cannot be held twice', function () {
    $shop = Shop::make(capacity: 1);

    Journey::placeHold($shop)->assertSessionHasNoErrors();
    $this->flushSession();

    Journey::placeHold($shop)->assertSessionHasErrors(['start_at' => 'That time was just taken. Choose another time.']);
    expect(Hold::query()->count())->toBe(1);
});

test('a start that is not an offered time is rejected', function () {
    $shop = Shop::make();

    Journey::placeHold($shop, '2026-10-06 10:07')->assertSessionHasErrors('start_at');   // off the grid
    Journey::placeHold($shop, '2026-10-06 08:00')->assertSessionHasErrors('start_at');   // before the window
    Journey::placeHold($shop, '2026-10-05 08:30')->assertSessionHasErrors('start_at');   // inside minimum notice
    Journey::placeHold($shop, '2026-12-31 10:00')->assertSessionHasErrors('start_at');   // beyond the horizon

    expect(Hold::query()->count())->toBe(0);
});

test('hold input is validated', function () {
    $shop = Shop::make();
    $url = route('bookings.holds.store', 'shine');

    $this->post($url, [])->assertSessionHasErrors(['idempotency_key', 'vehicle_type_id', 'service_id', 'add_on_ids', 'start_at']);
    $this->post($url, ['idempotency_key' => 'nope'] + Journey::holdPayload($shop))->assertSessionHasErrors('idempotency_key');
    $this->post($url, ['add_on_ids' => [1, 1]] + Journey::holdPayload($shop))->assertSessionHasErrors('add_on_ids.0');
    $this->post($url, ['start_at' => 'whenever'] + Journey::holdPayload($shop))->assertSessionHasErrors('start_at');
    $this->post($url, ['vehicle_make_model' => '   '] + Journey::holdPayload($shop))->assertSessionHasErrors('vehicle_make_model');
    $this->post($url, ['vehicle_make_model' => str_repeat('a', 121)] + Journey::holdPayload($shop))->assertSessionHasErrors('vehicle_make_model');
    $this->post($url, array_diff_key(Journey::holdPayload($shop), ['vehicle_make_model' => 1]))->assertSessionHasErrors('vehicle_make_model');
    $this->post($url, ['customer_vehicle_id' => 1] + Journey::holdPayload($shop))->assertSessionHasErrors('customer_vehicle_id');
    expect(Hold::query()->count())->toBe(0);
});

test('add-ons extend the held span and must be compatible', function () {
    $shop = Shop::make();
    $wax = $shop->addOn('Wax', 15000, 20);
    $other = $shop->addOn('Engine wash', 20000, 30, forService: false);

    Journey::placeHold($shop, addOnIds: [$other->id])->assertSessionHasErrors('add_on_ids');

    Journey::placeHold($shop, addOnIds: [$wax->id])->assertSessionHasNoErrors();
    $hold = Hold::query()->sole();
    expect($hold->add_on_ids)->toBe([$wax->id])
        ->and($hold->occupied_end_at->equalTo(Shop::at('2026-10-06 11:30')))->toBeTrue();
});

test('another tenant\'s ids are never accepted', function () {
    $shop = Shop::make('shine');
    $other = Shop::make('other');

    $payload = Journey::holdPayload($other);
    $this->post(route('bookings.holds.store', 'shine'), $payload)->assertSessionHasErrors('service_id');

    expect(Hold::query()->count())->toBe(0);
});

test('an unpublished or unready shop takes no holds', function () {
    $shop = Shop::make();
    $shop->organization->forceFill(['published_at' => null])->save();

    Journey::placeHold($shop)->assertNotFound();
    expect(Hold::query()->count())->toBe(0);

    $shop->organization->forceFill(['published_at' => now()])->save();
    $shop->records->resource->forceFill(['is_active' => false])->save();
    Journey::placeHold($shop)->assertNotFound();
});

test('holds are throttled per IP', function () {
    config(['rinquo.booking.hold_requests_per_ip' => 2]);
    $shop = Shop::make(capacity: 5);

    Journey::placeHold($shop, '2026-10-06 09:00');
    Journey::placeHold($shop, '2026-10-06 10:00');
    Journey::placeHold($shop, '2026-10-06 11:00')->assertStatus(429);
});

test('a hold is only reachable by its own browser session and shop', function () {
    $shop = Shop::make('shine');
    $other = Shop::make('other');
    $hold = Journey::hold($shop);

    $mine = route('bookings.holds.details', ['shine', $hold->public_id]);
    $this->withoutVite()->get($mine)->assertOk();

    $this->get(route('bookings.holds.details', ['other', $hold->public_id]))->assertNotFound();
    $this->flushSession();
    $this->get($mine)->assertNotFound();
    $this->put(route('bookings.holds.details.save', ['shine', $hold->public_id]), ['contact_name' => 'X', 'vehicle_make_model' => 'Toyota Vios', 'email' => 'x@example.test'])->assertNotFound();
    $this->post(route('bookings.holds.confirm', ['shine', $hold->public_id]))->assertNotFound();
});

test('the details page summarises the hold without scheduler internals', function () {
    $shop = Shop::make(capacity: 3, units: 2);
    $hold = Journey::hold($shop);

    $response = $this->withoutVite()->get(route('bookings.holds.details', ['shine', $hold->public_id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('shops/book/details')
            ->where('hold.publicId', $hold->public_id)
            ->where('hold.expired', false)
            ->where('hold.expiresInSeconds', 900)
            ->where('summary.serviceName', 'Full wash')
            ->where('summary.vehicleName', 'Sedan')
            ->where('summary.totalCentavos', 35000)
            ->where('summary.durationMinutes', 60)
            ->missing('summary.bufferMinutes')
            ->where('summary.vehicleMakeModel', 'Toyota Vios')
            ->where('signedIn', false)
            ->where('verification.step', 'details'));

    expect(Journey::leaksInternals($response->original->getData()['page']['props']))->toBeFalse();
});

test('an expired hold is shown as expired and no longer claims capacity', function () {
    $shop = Shop::make(capacity: 1);
    $hold = Journey::hold($shop);
    $this->travel(16)->minutes();

    $this->withoutVite()->get(route('bookings.holds.details', ['shine', $hold->public_id]))
        ->assertInertia(fn (Assert $page) => $page->where('hold.expired', true)->where('hold.expiresInSeconds', 0));

    $this->flushSession();
    Journey::placeHold($shop, '2026-10-06 10:00')->assertSessionHasNoErrors();
});

test('re-selecting the same time with a different add-on set at capacity 1 replaces the session hold', function () {
    $shop = Shop::make(capacity: 1);
    $wax = $shop->addOn();
    $first = Journey::hold($shop, '2026-10-06 10:00');

    Journey::placeHold($shop, '2026-10-06 10:00', [$wax->id])->assertSessionHasNoErrors();

    expect($first->fresh()->status)->toBe(Hold::RELEASED)
        ->and(Hold::query()->where('status', Hold::ACTIVE)->count())->toBe(1);
});

test('a rejected replacement leaves the previous hold untouched', function () {
    $shop = Shop::make(capacity: 1);
    $first = Journey::hold($shop, '2026-10-06 10:00');

    Journey::placeHold($shop, '2026-10-06 03:00')->assertSessionHasErrors('start_at'); // outside opening hours

    expect($first->fresh()->status)->toBe(Hold::ACTIVE);
});

test('malformed hold and booking ids are a plain 404', function () {
    $shop = Shop::make();
    Journey::hold($shop);

    $this->get(route('bookings.holds.details', ['shine', 'not-a-uuid']))->assertNotFound();
    $this->post(route('bookings.holds.confirm', ['shine', 'not-a-uuid']))->assertNotFound();
    $this->get('/shops/shine/bookings/x')->assertNotFound();
});

test('a hold stores the trimmed make and model and a replay with another make and model is rejected', function () {
    $shop = Shop::make();
    $key = (string) Str::uuid();

    $this->post(route('bookings.holds.store', 'shine'), ['vehicle_make_model' => '  Toyota Vios  '] + Journey::holdPayload($shop, key: $key))->assertSessionHasNoErrors();
    expect(Hold::query()->sole()->vehicle_make_model)->toBe('Toyota Vios');

    $this->post(route('bookings.holds.store', 'shine'), ['vehicle_make_model' => 'Toyota Vios'] + Journey::holdPayload($shop, key: $key))->assertSessionHasNoErrors();
    $this->post(route('bookings.holds.store', 'shine'), ['vehicle_make_model' => 'Honda City'] + Journey::holdPayload($shop, key: $key))->assertSessionHasErrors('idempotency_key');
    expect(Hold::query()->count())->toBe(1);
});

test('a signed-out browser may send an empty saved-vehicle id but never a real one', function () {
    $shop = Shop::make();

    $this->post(route('bookings.holds.store', 'shine'), ['customer_vehicle_id' => null] + Journey::holdPayload($shop))->assertSessionHasNoErrors();
    expect(Hold::query()->count())->toBe(1);
});
