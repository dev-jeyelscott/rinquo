<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\TestingShopFixture;
use App\Modules\Tenancy\Http\Storefront;
use Illuminate\Routing\Router;

test('the browser-test shop fixture seeds a published, bookable, around-the-clock shop', function () {
    $this->postJson('/__testing/shop', ['slug' => 'fixture-shop', 'capacity' => 1])
        ->assertOk()
        ->assertJsonStructure(['slug', 'vehicleId', 'serviceId', 'addOnId']);

    $organization = app(Storefront::class)->visibleOrganization('fixture-shop');
    expect($organization)->not->toBeNull();

    $this->getJson('/__testing/bookings?slug=fixture-shop')->assertOk()->assertExactJson(['count' => 0]);
    expect(Booking::query()->count())->toBe(0);
});

test('the fixture routes exist only when APP_ENV is testing', function () {
    $routes = fn (string $environment): int => (function () use ($environment): int {
        app()->detectEnvironment(fn () => $environment);
        $router = new Router(app('events'), app());
        TestingShopFixture::register($router);

        return $router->getRoutes()->count();
    })();

    try {
        expect($routes('testing'))->toBe(2)
            ->and($routes('local'))->toBe(0)
            ->and($routes('staging'))->toBe(0)
            ->and($routes('production'))->toBe(0);
    } finally {
        app()->detectEnvironment(fn () => 'testing');
    }
});
