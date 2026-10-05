<?php

namespace App\Modules\Booking;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
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
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

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
            'staff' => ['nullable', 'boolean'],
            'booking_in_minutes' => ['nullable', 'integer', 'between:30,2880'],
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

            // An optional active Staff member, for the day-of operations browser journey.
            $staff = ! empty($data['staff']) ? User::query()->create(['email' => $slug.'-staff@example.test']) : null;
            if ($staff !== null) {
                $make(Membership::class, $scope + ['user_id' => $staff->id, 'role' => Membership::STAFF]);
            }

            // An optional confirmed online booking for a known customer, for the scheduling-conflict journey.
            $booking = isset($data['booking_in_minutes'])
                ? self::seedBooking($organization, $variant, $type, $vehicle, $service, $slug, (int) $data['booking_in_minutes'])
                : null;

            return response()->json([
                'customerEmail' => $booking?->contact_email,
                'bookingId' => $booking?->public_id,
                'slug' => $slug,
                'organizationId' => $organization->id,
                'staffEmail' => $staff?->email,
                'vehicleId' => $vehicle->getKey(),
                'serviceId' => $service->getKey(),
                'addOnId' => $addOn->getKey(),
            ]);
        });
    }

    /** A confirmed online booking on the shop's only resource, starting on the next quarter hour after the offset. */
    private static function seedBooking(Organization $organization, Model $variant, Model $type, Model $vehicle, Model $service, string $slug, int $minutes): Booking
    {
        $customer = User::query()->create(['email' => $slug.'-customer@example.test']);
        $start = CarbonImmutable::createFromTimestampUTC((int) (ceil(now()->addMinutes($minutes)->getTimestamp() / 900) * 900));
        $resource = PhysicalResource::query()->where('organization_id', $organization->id)->orderBy('id')->firstOrFail();
        $hold = new Hold;
        $hold->forceFill([
            'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'session_token_hash' => hash('sha256', Str::random(16)), 'idempotency_key' => (string) Str::uuid(),
            'service_vehicle_variant_id' => $variant->getKey(), 'resource_type_id' => $type->getKey(), 'physical_resource_id' => $resource->id, 'units' => 1,
            'scheduled_start_at' => $start, 'service_end_at' => $start->addMinutes(60), 'occupied_end_at' => $start->addMinutes(70), 'add_on_ids' => [],
            'status' => Hold::CONVERTED, 'expires_at' => now(),
        ])->save();

        $booking = new Booking;
        $booking->forceFill([
            'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'hold_id' => $hold->id, 'customer_user_id' => $customer->id, 'status' => Booking::CONFIRMED,
            'service_id' => $service->getKey(), 'service_name' => 'Full wash', 'vehicle_type_id' => $vehicle->getKey(), 'vehicle_type_name' => 'Sedan', 'service_vehicle_variant_id' => $variant->getKey(),
            'variant_price_centavos' => 35000, 'variant_duration_minutes' => 60, 'buffer_minutes' => 10, 'add_ons_price_centavos' => 0, 'add_ons_duration_minutes' => 0, 'total_price_centavos' => 35000,
            'resource_type_id' => $type->getKey(), 'resource_type_name' => 'Wash bay', 'consumption_units' => 1,
            'scheduled_start_at' => $start, 'service_end_at' => $start->addMinutes(60), 'occupied_end_at' => $start->addMinutes(70), 'branch_timezone' => 'Asia/Manila',
            'approval_mode' => 'auto_confirm', 'policy_snapshot' => ['slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120],
            'contact_name' => 'Casey Customer', 'contact_email' => $customer->email, 'physical_resource_id' => $resource->id, 'confirmed_at' => now(),
        ])->save();

        return $booking;
    }
}
