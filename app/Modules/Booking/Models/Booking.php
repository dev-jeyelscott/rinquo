<?php

namespace App\Modules\Booking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer booking. The snapshot columns (service, vehicle, prices,
 * durations, buffer, consumption, policy, contact) are immutable, enforced by
 * a PostgreSQL trigger; status, planned resource assignment and notification
 * timestamps stay mutable.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property int $hold_id
 * @property int $customer_user_id
 * @property string $status
 * @property int $service_id
 * @property string $service_name
 * @property int $vehicle_type_id
 * @property string $vehicle_type_name
 * @property int $service_vehicle_variant_id
 * @property int $variant_price_centavos
 * @property int $variant_duration_minutes
 * @property int $buffer_minutes
 * @property int $add_ons_price_centavos
 * @property int $add_ons_duration_minutes
 * @property int $total_price_centavos
 * @property int $resource_type_id
 * @property string $resource_type_name
 * @property int $consumption_units
 * @property CarbonImmutable $scheduled_start_at
 * @property CarbonImmutable $service_end_at
 * @property CarbonImmutable $occupied_end_at
 * @property string $branch_timezone
 * @property string $approval_mode
 * @property array<string, int> $policy_snapshot
 * @property string $contact_name
 * @property string $contact_email
 * @property ?string $contact_phone
 * @property ?string $vehicle_plate
 * @property ?string $customer_notes
 * @property int $physical_resource_id
 * @property ?CarbonImmutable $pending_expires_at
 * @property ?CarbonImmutable $confirmed_at
 * @property ?CarbonImmutable $decided_at
 * @property ?int $decided_by_user_id
 * @property ?CarbonImmutable $expired_at
 * @property ?CarbonImmutable $reminder_sent_at
 */
class Booking extends Model
{
    public const PENDING_APPROVAL = 'pending_approval';

    public const CONFIRMED = 'confirmed';

    public const DECLINED = 'declined';

    public const EXPIRED = 'expired';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'scheduled_start_at' => 'immutable_datetime',
            'service_end_at' => 'immutable_datetime',
            'occupied_end_at' => 'immutable_datetime',
            'policy_snapshot' => 'array',
            'pending_expires_at' => 'immutable_datetime',
            'confirmed_at' => 'immutable_datetime',
            'decided_at' => 'immutable_datetime',
            'expired_at' => 'immutable_datetime',
            'reminder_sent_at' => 'immutable_datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING_APPROVAL;
    }

    /** @return HasMany<BookingAddOn, $this> */
    public function addOns(): HasMany
    {
        return $this->hasMany(BookingAddOn::class)->orderBy('id');
    }
}
