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
 * @property ?int $customer_user_id
 * @property string $source
 * @property string $operational_state
 * @property int $operation_revision
 * @property ?CarbonImmutable $checked_in_at
 * @property ?CarbonImmutable $started_at
 * @property ?CarbonImmutable $completed_at
 * @property ?CarbonImmutable $no_show_at
 * @property ?int $actual_resource_id
 * @property ?CarbonImmutable $capacity_release_at
 * @property ?CarbonImmutable $queue_priority_at
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
 * @property ?string $contact_email
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

    public const CANCELLED = 'cancelled';

    public const RESCHEDULED = 'rescheduled';

    public const SOURCE_ONLINE = 'online';

    public const SOURCE_STAFF = 'staff';

    public const SOURCE_WALK_IN = 'walk_in';

    public const SCHEDULED = 'scheduled';

    public const CHECKED_IN = 'checked_in';

    public const IN_SERVICE = 'in_service';

    public const COMPLETED = 'completed';

    public const NO_SHOW = 'no_show';

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
            'checked_in_at' => 'immutable_datetime',
            'started_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'no_show_at' => 'immutable_datetime',
            'capacity_release_at' => 'immutable_datetime',
            'queue_priority_at' => 'immutable_datetime',
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

    public function isLive(): bool
    {
        return $this->status === self::CONFIRMED
            || ($this->isPending() && $this->pending_expires_at !== null && $this->pending_expires_at->isFuture());
    }

    /** The physical resource currently holding this booking's capacity. */
    public function claimedResourceId(): int
    {
        return $this->actual_resource_id ?? $this->physical_resource_id;
    }

    /** Total service minutes from the immutable snapshot (variant plus add-ons). */
    public function serviceMinutes(): int
    {
        return $this->variant_duration_minutes + $this->add_ons_duration_minutes;
    }

    /** When the service is projected to finish: actual start plus snapshot duration, else the planned end. */
    public function projectedServiceEnd(): CarbonImmutable
    {
        return $this->started_at !== null
            ? $this->started_at->addMinutes($this->serviceMinutes())
            : $this->service_end_at;
    }

    /**
     * When this booking stops claiming capacity. A recorded release (completion
     * or confirmed no-show) wins; in service it extends past the plan for a late
     * start or an overrun, always keeping the buffer; otherwise the plan holds.
     * The historical snapshot timestamps are never read back from this value.
     */
    public function capacityEndsAt(CarbonImmutable $now): CarbonImmutable
    {
        if ($this->capacity_release_at !== null) {
            return $this->capacity_release_at;
        }
        if ($this->operational_state === self::IN_SERVICE && $this->started_at !== null) {
            $buffer = $this->buffer_minutes;

            return $this->occupied_end_at
                ->max($this->projectedServiceEnd()->addMinutes($buffer))
                ->max($now->addMinutes($buffer));
        }

        return $this->occupied_end_at;
    }

    /** The queue ordering key: manual priority when set, otherwise the appointment time. */
    public function queueKey(): CarbonImmutable
    {
        return $this->queue_priority_at ?? $this->scheduled_start_at;
    }

    /** @return HasMany<BookingAddOn, $this> */
    public function addOns(): HasMany
    {
        return $this->hasMany(BookingAddOn::class)->orderBy('id');
    }
}
