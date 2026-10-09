<?php

namespace App\Modules\Booking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A temporary checkout claim on one physical resource. It is live only while
 * active and unexpired: expiry is enforced by the time predicate, so capacity
 * frees at expires_at even before the sweeper marks the row expired.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property string $session_token_hash
 * @property string $idempotency_key
 * @property int $service_vehicle_variant_id
 * @property int $resource_type_id
 * @property int $physical_resource_id
 * @property int $units
 * @property CarbonImmutable $scheduled_start_at
 * @property CarbonImmutable $service_end_at
 * @property CarbonImmutable $occupied_end_at
 * @property list<int> $add_on_ids
 * @property ?string $contact_name
 * @property ?string $contact_phone
 * @property ?string $vehicle_make_model
 * @property ?string $vehicle_plate
 * @property ?string $customer_notes
 * @property string $status
 * @property CarbonImmutable $expires_at
 * @property CarbonImmutable $created_at
 */
class Hold extends Model
{
    public const ACTIVE = 'active';

    public const CONVERTED = 'converted';

    public const RELEASED = 'released';

    public const EXPIRED = 'expired';

    protected $table = 'booking_holds';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'scheduled_start_at' => 'immutable_datetime',
            'service_end_at' => 'immutable_datetime',
            'occupied_end_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
            'add_on_ids' => 'array',
        ];
    }

    public function isLive(): bool
    {
        return $this->status === self::ACTIVE && $this->expires_at->isFuture();
    }

    public function hasDetails(): bool
    {
        return trim((string) $this->contact_name) !== '' && $this->hasVehicle();
    }

    /** New holds always carry a make/model; holds from before it was collected must be completed on Details. */
    public function hasVehicle(): bool
    {
        return trim((string) $this->vehicle_make_model) !== '';
    }

    /** @return HasOne<Booking, $this> */
    public function booking(): HasOne
    {
        return $this->hasOne(Booking::class, 'hold_id');
    }
}
