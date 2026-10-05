<?php

namespace App\Modules\Booking;

use App\Modules\Booking\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Actions\CreateOrganization;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/**
 * Browser-test support: seeds a ready, published shop that is open around the
 * clock, so a Playwright run can book at whatever time it executes. Registered
 * ONLY when APP_ENV is "testing", exactly like the sign-in code peek; in every
 * other environment neither route exists. The routes sit outside the web
 * group on purpose (no session or CSRF), like a test harness endpoint.
 */
final class TestingShopFixture
{
    public static function register(?Router $router = null): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        $router ??= app('router');

        $router->post('__testing/shop', fn (Request $request) => self::seed($request))->name('testing.shop');
        $router->get('__testing/bookings', fn (Request $request) => response()->json([
            'count' => Booking::query()
                ->whereIn('organization_id', Organization::query()->where('slug', (string) $request->query('slug'))->select('id'))
                ->count(),
        ]))->name('testing.bookings');
    }

    private static function seed(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:60'],
            'capacity' => ['nullable', 'integer', 'between:1,10'],
            'approval_mode' => ['nullable', 'in:auto_confirm,staff_approval'],
        ]);

        return DB::transaction(function () use ($data): JsonResponse {
            $slug = $data['slug'];
            $owner = User::query()->create(['email' => $slug.'-owner@example.test']);
            $organization = app(CreateOrganization::class)->handle($owner, 'Fixture '.$slug, $slug, 'Main branch');
            $scope = ['organization_id' => $organization->id];
            $make = function (string $class, array $attributes): Model {
                /** @var Model $record */
                $record = new $class;
                $record->forceFill($attributes)->save();

                return $record;
            };

            $organization->forceFill(['tagline' => 'Spotless every time', 'description' => 'Hand wash and detailing.', 'brand_color' => '#1E40AF'])->save();
            $branch = $organization->branch()->firstOrFail();
            $branch->forceFill(['address_line' => '1 Rizal Ave', 'city' => 'Manila'])->save();
            $organization->bookingPolicy()->firstOrFail()->forceFill(['approval_mode' => $data['approval_mode'] ?? 'auto_confirm'])->save();

            $vehicle = $make(VehicleType::class, $scope + ['name' => 'Sedan']);
            $service = $make(Service::class, $scope + ['name' => 'Full wash']);
            $type = $make(ResourceType::class, $scope + ['branch_id' => $branch->id, 'name' => 'Wash bay']);
            $make(PhysicalResource::class, $scope + ['resource_type_id' => $type->getKey(), 'name' => 'Bay 1', 'capacity' => $data['capacity'] ?? 1]);
            $variant = $make(ServiceVehicleVariant::class, $scope + ['service_id' => $service->getKey(), 'vehicle_type_id' => $vehicle->getKey(), 'price_centavos' => 35000, 'duration_minutes' => 60, 'buffer_minutes' => 10]);
            $make(CapacityConsumption::class, $scope + ['service_vehicle_variant_id' => $variant->getKey(), 'resource_type_id' => $type->getKey(), 'units' => 1]);
            $addOn = $make(AddOn::class, $scope + ['name' => 'Wax', 'price_centavos' => 15000, 'duration_minutes' => 20]);
            DB::table('add_on_vehicle_options')->insert($scope + ['add_on_id' => $addOn->getKey(), 'vehicle_type_id' => $vehicle->getKey(), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('service_add_ons')->insert($scope + ['service_id' => $service->getKey(), 'add_on_id' => $addOn->getKey(), 'created_at' => now(), 'updated_at' => now()]);

            foreach (range(1, 7) as $weekday) {
                $make(BranchWeeklyHour::class, $scope + ['branch_id' => $branch->id, 'weekday' => $weekday, 'opens_at' => '00:00', 'closes_at' => '23:59']);
                $make(ServiceWindow::class, $scope + ['service_id' => $service->getKey(), 'weekday' => $weekday, 'starts_at' => '00:00', 'ends_at' => '23:59']);
            }

            $organization->forceFill(['published_at' => now()])->save();

            return response()->json([
                'slug' => $slug,
                'vehicleId' => $vehicle->getKey(),
                'serviceId' => $service->getKey(),
                'addOnId' => $addOn->getKey(),
            ]);
        });
    }
}
