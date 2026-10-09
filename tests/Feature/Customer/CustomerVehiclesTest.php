<?php

use App\Modules\Customer\Models\CustomerVehicle;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

test('a saved vehicle requires a make and model, with an optional plate and nickname', function () {
    $customer = Tenant::user('driver@example.test');
    $this->actingAs($customer);

    $this->post(route('customer.vehicles.store'), ['plate' => 'abc 123'])->assertSessionHasErrors('make_model');
    $this->post(route('customer.vehicles.store'), ['make_model' => str_repeat('a', 121)])->assertSessionHasErrors('make_model');
    expect(CustomerVehicle::query()->count())->toBe(0);

    $this->post(route('customer.vehicles.store'), ['make_model' => ' Honda City ', 'plate' => ' abc 123 ', 'label' => 'Daily'])->assertSessionHasNoErrors();
    $this->post(route('customer.vehicles.store'), ['make_model' => 'Toyota Wigo'])->assertSessionHasNoErrors();

    $plated = CustomerVehicle::query()->where('plate', 'ABC 123')->sole();
    expect($plated->make_model)->toBe('Honda City')->and($plated->label)->toBe('Daily')
        ->and(CustomerVehicle::query()->whereNull('plate')->sole()->make_model)->toBe('Toyota Wigo');
});

test('saving the same vehicle again updates it and revives an archived one', function () {
    $customer = Tenant::user('driver@example.test');
    $this->actingAs($customer);

    $this->post(route('customer.vehicles.store'), ['make_model' => 'Honda City', 'plate' => 'ABC 123'])->assertSessionHasNoErrors();
    CustomerVehicle::query()->update(['archived_at' => now()]);
    $this->post(route('customer.vehicles.store'), ['make_model' => 'Honda City RS', 'plate' => 'abc 123'])->assertSessionHasNoErrors();
    $this->post(route('customer.vehicles.store'), ['make_model' => 'Toyota Wigo'])->assertSessionHasNoErrors();
    $this->post(route('customer.vehicles.store'), ['make_model' => 'TOYOTA WIGO'])->assertSessionHasNoErrors();

    expect(CustomerVehicle::query()->count())->toBe(2)
        ->and(CustomerVehicle::query()->where('plate', 'ABC 123')->sole()->archived_at)->toBeNull()
        ->and(CustomerVehicle::query()->where('plate', 'ABC 123')->sole()->make_model)->toBe('Honda City RS');
});

test('vehicles are private to their owner and archiving is owner only', function () {
    $owner = Tenant::user('owner-driver@example.test');
    $other = Tenant::user('other-driver@example.test');
    $vehicle = CustomerVehicle::query()->create(['user_id' => $owner->id, 'make_model' => 'Honda City', 'plate' => 'ABC 123']);
    CustomerVehicle::query()->create(['user_id' => $other->id, 'make_model' => 'Mazda 3']);

    $this->actingAs($other)->post(route('customer.vehicles.archive', $vehicle))->assertNotFound();
    expect($vehicle->fresh()->archived_at)->toBeNull();

    $this->actingAs($owner)->withoutVite()->get(route('customer.vehicles'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/vehicles')
            ->has('vehicles', 1)
            ->where('vehicles.0.makeModel', 'Honda City')
            ->where('vehicles.0.plate', 'ABC 123'));

    $this->post(route('customer.vehicles.archive', $vehicle))->assertRedirect();
    expect($vehicle->fresh()->archived_at)->not->toBeNull();
});

test('a legacy saved vehicle without a make and model stays listed and usable', function () {
    $owner = Tenant::user('legacy-driver@example.test');
    CustomerVehicle::query()->create(['user_id' => $owner->id, 'plate' => 'OLD 111']);

    $this->actingAs($owner)->withoutVite()->get(route('customer.vehicles'))
        ->assertInertia(fn (Assert $page) => $page->where('vehicles.0.makeModel', null)->where('vehicles.0.plate', 'OLD 111'));
});
