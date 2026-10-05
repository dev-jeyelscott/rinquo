<?php

namespace Tests\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;

/** Builders for tenant fixtures used across feature tests. */
final class Tenant
{
    /** Creates a tenant-owned record (organization_id is deliberately not mass-assignable). */
    public static function make(string $class, array $attributes): object
    {
        $record = new $class;
        $record->forceFill($attributes)->save();

        return $record;
    }

    public static function user(string $email = 'owner@example.test'): User
    {
        return User::query()->create(['email' => $email]);
    }

    /** An organization with one branch and one membership of the given role. */
    public static function organization(string $slug = 'shine', string $role = Membership::OWNER, ?User $user = null): array
    {
        $user ??= self::user($slug.'-'.$role.'@example.test');
        $organization = Organization::query()->create(['name' => ucfirst($slug), 'slug' => $slug]);
        $organization->branch()->create(['name' => 'Main branch']);
        $organization->bookingPolicy()->save(new BookingPolicy);
        Membership::query()->create(['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => $role]);

        return [$user, $organization];
    }

    /** Completes the profile, hours and one feasible offering. Returns the created records. */
    public static function makeReady(Organization $organization): object
    {
        $organization->forceFill([
            'tagline' => 'Spotless every time',
            'description' => 'Hand wash and detailing.',
            'brand_color' => '#1E40AF',
        ])->save();
        $branch = $organization->branch()->firstOrFail();
        $branch->forceFill(['address_line' => '1 Rizal Ave', 'city' => 'Manila'])->save();

        foreach (range(1, 7) as $weekday) {
            self::make(BranchWeeklyHour::class, [
                'organization_id' => $organization->id, 'branch_id' => $branch->id,
                'weekday' => $weekday, 'opens_at' => '08:00', 'closes_at' => '18:00',
            ]);
        }

        $scope = ['organization_id' => $organization->id];
        $vehicle = self::make(VehicleType::class, $scope + ['name' => 'Sedan']);
        $service = self::make(Service::class, $scope + ['name' => 'Full wash']);
        $type = self::make(ResourceType::class, $scope + ['branch_id' => $branch->id, 'name' => 'Wash bay']);
        $resource = self::make(PhysicalResource::class, $scope + ['resource_type_id' => $type->id, 'name' => 'Bay 1', 'capacity' => 2]);
        $variant = self::make(ServiceVehicleVariant::class, $scope + [
            'service_id' => $service->id, 'vehicle_type_id' => $vehicle->id,
            'price_centavos' => 35000, 'duration_minutes' => 60, 'buffer_minutes' => 10,
        ]);
        self::make(CapacityConsumption::class, $scope + ['service_vehicle_variant_id' => $variant->id, 'resource_type_id' => $type->id, 'units' => 1]);
        self::make(ServiceWindow::class, $scope + ['service_id' => $service->id, 'weekday' => 1, 'starts_at' => '09:00', 'ends_at' => '17:00']);

        return (object) compact('vehicle', 'service', 'type', 'resource', 'variant');
    }
}
