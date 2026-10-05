<?php

namespace Tests\Support;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A published, ready booking shop for booking tests. The reference clock is
 * Monday 2026-10-05 08:00 Asia/Manila. Hours are 08:00-18:00 every day and the
 * service window is 09:00-17:00 every day; the Sedan "Full wash" takes 60
 * minutes plus a 10 minute buffer and consumes 1 unit of a 2-capacity bay.
 */
final class Shop
{
    public const NOW = '2026-10-05 08:00:00';

    public function __construct(
        public readonly User $owner,
        public readonly Organization $organization,
        public readonly object $records,
    ) {}

    /** Local Asia/Manila wall-clock time as a UTC instant. */
    public static function at(string $local): CarbonImmutable
    {
        return CarbonImmutable::parse($local, 'Asia/Manila')->utc();
    }

    public static function make(string $slug = 'shine', int $capacity = 2, int $units = 1): self
    {
        test()->travelTo(self::at(self::NOW));

        [$owner, $organization] = Tenant::organization($slug);
        $records = Tenant::makeReady($organization);

        foreach (range(2, 7) as $weekday) {
            Tenant::make(ServiceWindow::class, [
                'organization_id' => $organization->id, 'service_id' => $records->service->id,
                'weekday' => $weekday, 'starts_at' => '09:00', 'ends_at' => '17:00',
            ]);
        }

        $records->resource->forceFill(['capacity' => $capacity])->save();
        CapacityConsumption::query()->where('service_vehicle_variant_id', $records->variant->id)->update(['units' => $units]);

        $organization->forceFill(['published_at' => now()])->save();

        return new self($owner, $organization->fresh(), $records);
    }

    /** @param  array<string, mixed>  $attributes */
    public function policy(array $attributes): self
    {
        $this->organization->bookingPolicy()->firstOrFail()->forceFill($attributes)->save();

        return $this;
    }

    public function addOn(string $name = 'Wax', int $price = 15000, int $minutes = 20, bool $forService = true): AddOn
    {
        $scope = ['organization_id' => $this->organization->id];
        $addOn = Tenant::make(AddOn::class, $scope + ['name' => $name, 'price_centavos' => $price, 'duration_minutes' => $minutes]);
        DB::table('add_on_vehicle_options')->insert($scope + ['add_on_id' => $addOn->id, 'vehicle_type_id' => $this->records->vehicle->id, 'created_at' => now(), 'updated_at' => now()]);

        if ($forService) {
            DB::table('service_add_ons')->insert($scope + ['service_id' => $this->records->service->id, 'add_on_id' => $addOn->id, 'created_at' => now(), 'updated_at' => now()]);
        }

        return $addOn;
    }

    public function resource(string $name, int $capacity, ?int $typeId = null): PhysicalResource
    {
        return Tenant::make(PhysicalResource::class, [
            'organization_id' => $this->organization->id,
            'resource_type_id' => $typeId ?? $this->records->type->id,
            'name' => $name,
            'capacity' => $capacity,
        ]);
    }

    /**
     * A live (or, with $status/$expiresAt, inactive) hold directly in the table.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function hold(string $localStart, int $units = 1, int $minutes = 70, ?PhysicalResource $resource = null, array $attributes = []): Hold
    {
        $start = self::at($localStart);
        $resource ??= $this->records->resource;

        return Tenant::make(Hold::class, $attributes + [
            'organization_id' => $this->organization->id,
            'public_id' => (string) Str::uuid(),
            'session_token_hash' => hash('sha256', Str::random(16)),
            'idempotency_key' => (string) Str::uuid(),
            'service_vehicle_variant_id' => $this->records->variant->id,
            'resource_type_id' => $resource->resource_type_id,
            'physical_resource_id' => $resource->id,
            'units' => $units,
            'scheduled_start_at' => $start,
            'service_end_at' => $start->addMinutes($minutes - 10),
            'occupied_end_at' => $start->addMinutes($minutes),
            'add_on_ids' => [],
            'status' => Hold::ACTIVE,
            'expires_at' => now()->addMinutes(15),
        ]);
    }

    /**
     * A booking claim directly in the table (its own converted hold included).
     *
     * @param  array<string, mixed>  $attributes
     */
    public function booking(string $localStart, string $status = Booking::CONFIRMED, int $units = 1, int $minutes = 70, ?PhysicalResource $resource = null, array $attributes = []): Booking
    {
        $start = self::at($localStart);
        $resource ??= $this->records->resource;
        $hold = $this->hold($localStart, $units, $minutes, $resource, ['status' => Hold::CONVERTED]);
        $customer = Tenant::user('customer-'.Str::lower(Str::random(6)).'@example.test');

        return Tenant::make(Booking::class, $attributes + [
            'organization_id' => $this->organization->id,
            'public_id' => (string) Str::uuid(),
            'hold_id' => $hold->id,
            'customer_user_id' => $customer->id,
            'status' => $status,
            'service_id' => $this->records->service->id,
            'service_name' => 'Full wash',
            'vehicle_type_id' => $this->records->vehicle->id,
            'vehicle_type_name' => 'Sedan',
            'service_vehicle_variant_id' => $this->records->variant->id,
            'variant_price_centavos' => 35000,
            'variant_duration_minutes' => $minutes - 10,
            'buffer_minutes' => 10,
            'add_ons_price_centavos' => 0,
            'add_ons_duration_minutes' => 0,
            'total_price_centavos' => 35000,
            'resource_type_id' => $resource->resource_type_id,
            'resource_type_name' => 'Wash bay',
            'consumption_units' => $units,
            'scheduled_start_at' => $start,
            'service_end_at' => $start->addMinutes($minutes - 10),
            'occupied_end_at' => $start->addMinutes($minutes),
            'branch_timezone' => 'Asia/Manila',
            'approval_mode' => 'auto_confirm',
            'policy_snapshot' => ['slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120],
            'contact_name' => 'Ana Cruz',
            'contact_email' => $customer->email,
            'physical_resource_id' => $resource->id,
            'confirmed_at' => $status === Booking::CONFIRMED ? now() : null,
            'pending_expires_at' => $status === Booking::PENDING_APPROVAL ? now()->addHours(2) : null,
        ]);
    }

    public function member(string $role): User
    {
        $user = Tenant::user($role.'-'.Str::lower(Str::random(6)).'@example.test');
        Membership::query()->create(['organization_id' => $this->organization->id, 'user_id' => $user->id, 'role' => $role]);

        return $user;
    }
}
