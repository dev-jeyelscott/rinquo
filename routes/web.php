<?php

use App\Modules\Identity\Http\Controllers\OwnerAuthController;
use App\Modules\Scheduling\Http\Controllers\CatalogController;
use App\Modules\Scheduling\Http\Controllers\HoursController;
use App\Modules\Scheduling\Http\Controllers\RecordController;
use App\Modules\Scheduling\Http\Controllers\ResourcesController;
use App\Modules\Tenancy\Http\Controllers\OnboardingController;
use App\Modules\Tenancy\Http\Controllers\OwnerHomeController;
use App\Modules\Tenancy\Http\Controllers\ProfileController;
use App\Modules\Tenancy\Http\Controllers\PublicationController;
use App\Modules\Tenancy\Http\Controllers\PublicShopController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

/*
|--------------------------------------------------------------------------
| Owner: email-code sign-in, onboarding and settings
|--------------------------------------------------------------------------
*/
Route::prefix('owner')->name('owner.')->group(function (): void {
    Route::middleware('guest')->prefix('auth')->name('auth.')->group(function (): void {
        Route::get('login', [OwnerAuthController::class, 'show'])->name('login');
        Route::post('code', [OwnerAuthController::class, 'requestCode'])->name('code');
        Route::post('verify', [OwnerAuthController::class, 'verify'])->name('verify');
        Route::post('restart', [OwnerAuthController::class, 'restart'])->name('restart');
    });

    Route::middleware('auth')->group(function (): void {
        Route::post('auth/logout', [OwnerAuthController::class, 'logout'])->name('auth.logout');
        Route::get('/', OwnerHomeController::class)->name('home');
        Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
        Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');

        // Owner-only. The policy is resolved against the route-bound
        // organization, and child ids resolve through that organization
        // (scoped bindings), so another tenant's ids are a 404.
        Route::prefix('organizations/{organization}/settings')
            ->name('settings.')
            ->middleware('can:manage,organization')
            ->scopeBindings()
            ->group(function (): void {
                Route::get('profile', [ProfileController::class, 'show'])->name('profile');
                Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');
                Route::post('media', [ProfileController::class, 'storeMedia'])->name('media.store');
                Route::get('media/{media}', [ProfileController::class, 'showMedia'])->name('media.show');
                Route::post('media/{media}/archive', [ProfileController::class, 'archiveMedia'])->name('media.archive');

                Route::get('hours', [HoursController::class, 'show'])->name('hours');
                Route::put('hours', [HoursController::class, 'update'])->name('hours.update');

                Route::get('services', [CatalogController::class, 'show'])->name('services');
                Route::post('vehicle-types', [RecordController::class, 'storeVehicleType'])->name('vehicle-types.store');
                Route::patch('vehicle-types/{vehicleType}', [RecordController::class, 'updateVehicleType'])->name('vehicle-types.update');
                Route::post('vehicle-types/{vehicleType}/archive', [RecordController::class, 'archiveVehicleType'])->name('vehicle-types.archive');
                Route::post('services', [RecordController::class, 'storeService'])->name('services.store');
                Route::patch('services/{service}', [RecordController::class, 'updateService'])->name('services.update');
                Route::post('services/{service}/archive', [RecordController::class, 'archiveService'])->name('services.archive');
                Route::put('services/{service}/windows', [RecordController::class, 'replaceWindows'])->name('services.windows');
                Route::post('services/{service}/variants', [RecordController::class, 'storeVariant'])->name('variants.store');
                Route::patch('services/{service}/variants/{variant}', [RecordController::class, 'updateVariant'])->name('variants.update');
                Route::post('services/{service}/variants/{variant}/archive', [RecordController::class, 'archiveVariant'])->name('variants.archive');
                Route::put('services/{service}/variants/{variant}/consumption', [RecordController::class, 'replaceConsumption'])->name('variants.consumption');
                Route::post('add-ons', [RecordController::class, 'storeAddOn'])->name('add-ons.store');
                Route::patch('add-ons/{addOn}', [RecordController::class, 'updateAddOn'])->name('add-ons.update');
                Route::post('add-ons/{addOn}/archive', [RecordController::class, 'archiveAddOn'])->name('add-ons.archive');

                Route::get('resources', [ResourcesController::class, 'show'])->name('resources');
                Route::post('resource-types', [RecordController::class, 'storeResourceType'])->name('resource-types.store');
                Route::patch('resource-types/{resourceType}', [RecordController::class, 'updateResourceType'])->name('resource-types.update');
                Route::post('resource-types/{resourceType}/archive', [RecordController::class, 'archiveResourceType'])->name('resource-types.archive');
                Route::post('resources', [RecordController::class, 'storeResource'])->name('resources.store');
                Route::patch('resources/{physicalResource}', [RecordController::class, 'updateResource'])->name('resources.update');
                Route::post('resources/{physicalResource}/archive', [RecordController::class, 'archiveResource'])->name('resources.archive');

                Route::get('readiness', [PublicationController::class, 'show'])->name('readiness');
                Route::post('publish', [PublicationController::class, 'publish'])->name('publish');
                Route::post('unpublish', [PublicationController::class, 'unpublish'])->name('unpublish');
            });
    });
});

/*
|--------------------------------------------------------------------------
| Public tenant storefront
|--------------------------------------------------------------------------
*/
Route::get('shops/{slug}', [PublicShopController::class, 'show'])->name('shops.show');
Route::get('shops/{slug}/media/{media}', [PublicShopController::class, 'media'])->name('shops.media')->whereNumber('media');
