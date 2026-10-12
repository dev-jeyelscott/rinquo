<?php

use App\Modules\Customer\Directory\ShopDirectory;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;
use Tests\Support\Tenant;

function listed(string $slug): Shop
{
    $shop = Shop::make($slug);
    $shop->organization->forceFill(['directory_opted_in' => true])->save();

    return $shop;
}

beforeEach(function () {
    $this->customer = Tenant::user('driver@example.test');
});

test('only opted-in, published, ready shops are listed, with bounded card facts', function () {
    $shine = listed('shine');
    $hidden = Shop::make('hidden');
    $unready = listed('unready');
    BranchWeeklyHour::query()->where('organization_id', $unready->organization->id)->delete();
    $draft = listed('draft');
    $draft->organization->forceFill(['published_at' => null])->save();

    // A cheaper variant that cannot be booked (no capacity consumption) must not add its service or lower the price.
    $cheap = Tenant::make(Service::class, ['organization_id' => $shine->organization->id, 'name' => 'Cheap rinse', 'is_active' => true]);
    Tenant::make(ServiceVehicleVariant::class, [
        'organization_id' => $shine->organization->id, 'service_id' => $cheap->id,
        'vehicle_type_id' => $shine->records->vehicle->id, 'price_centavos' => 100, 'duration_minutes' => 30,
        'buffer_minutes' => 0, 'is_active' => true,
    ]);
    $logo = OrganizationMedia::query()->forceCreate(['organization_id' => $shine->organization->id, 'kind' => OrganizationMedia::LOGO, 'storage_key' => 'private/logo.png', 'mime_type' => 'image/png', 'alt_text' => 'Shine logo', 'sort_order' => 0]);

    $this->actingAs($this->customer)->withoutVite()->get(route('customer.directory'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customer/directory')
            ->where('hasMore', false)
            ->has('shops', 1)
            ->where('shops.0.name', 'Shine')
            ->where('shops.0.city', 'Manila')
            ->where('shops.0.services', [$shine->records->service->name])
            ->where('shops.0.fromPriceCentavos', $shine->records->variant->price_centavos)
            ->where('shops.0.hours', ['Daily · 8:00 AM–6:00 PM'])
            ->where('shops.0.logo.url', route('shops.media', ['shine', $logo->id], absolute: false))
            ->where('shops.0.cover', null)
            ->where('shops.0.url', '/shops/shine')
            ->where('shops.0.bookingUrl', '/shops/shine/book'));

    $json = json_encode($this->get(route('customer.directory'))->viewData('page'));
    expect($json)->not->toContain('private/logo.png')->not->toContain('Hidden');
});

test('search matches business name or city case-insensitively and treats wildcards literally', function () {
    listed('shine');
    $north = listed('northline');
    $north->organization->branch->forceFill(['city' => 'Pasig City'])->save();

    $search = fn (string $q) => $this->actingAs($this->customer)->withoutVite()->get(route('customer.directory', ['q' => $q]));

    $search('PASIG')->assertInertia(fn (Assert $page) => $page->where('query', 'PASIG')->has('shops', 1)->where('shops.0.name', 'Northline'));
    $search('shi')->assertInertia(fn (Assert $page) => $page->has('shops', 1)->where('shops.0.name', 'Shine'));
    $search('%')->assertInertia(fn (Assert $page) => $page->has('shops', 0));
    $search('Nonexistent Wash Center')->assertInertia(fn (Assert $page) => $page->has('shops', 0)->where('hasMore', false));
});

test('the directory scan finds eligible shops past unready ones and reports more beyond the page', function () {
    $unready = listed('aaa-unready');
    BranchWeeklyHour::query()->where('organization_id', $unready->organization->id)->delete();
    foreach (['bbb', 'ccc', 'ddd'] as $slug) {
        listed($slug);
    }

    $result = app(ShopDirectory::class)->search('');
    expect(array_column($result['shops'], 'name'))->toBe(['Bbb', 'Ccc', 'Ddd'])->and($result['hasMore'])->toBeFalse();

    // Card facts are batch-loaded once per page, never per card.
    DB::enableQueryLog();
    app(ShopDirectory::class)->search('');
    $mediaQueries = collect(DB::getQueryLog())->filter(fn (array $entry): bool => str_contains($entry['query'], 'from "organization_media"'));
    DB::disableQueryLog();
    expect($mediaQueries)->toHaveCount(1);
});

test('weekly hours are summarized as runs of matching days', function () {
    $shop = listed('weekday');
    BranchWeeklyHour::query()->where('organization_id', $shop->organization->id)->where('weekday', 7)->delete();
    BranchWeeklyHour::query()->where('organization_id', $shop->organization->id)->where('weekday', 6)->update(['closes_at' => '14:00']);
    Service::query()->whereKey($shop->records->service->id)->update(['name' => 'Exterior wash']);

    $card = app(ShopDirectory::class)->search('')['shops'][0];
    expect($card['hours'])->toBe(['Mon–Fri · 8:00 AM–6:00 PM', 'Sat · 8:00 AM–2:00 PM'])
        ->and($card['services'])->toBe(['Exterior wash']);
});

test('guests are sent to the customer sign-in, not the Owner one', function () {
    $this->get(route('customer.directory'))->assertRedirect(route('customer.auth.login'));
    $this->get(route('customer.bookings'))->assertRedirect(route('customer.auth.login'));
    $this->get(route('owner.home'))->assertRedirect(route('owner.auth.login'));

    $this->actingAs($this->customer)->get(route('customer.auth.login'))->assertRedirect(route('customer.directory'));
});
