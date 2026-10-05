<?php

namespace App\Modules\Booking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An explicit "this booking cannot be fulfilled as scheduled" record, separate
 * from the booking lifecycle. The booking keeps its confirmed status, snapshots
 * and original slot; only a customer-accepted replacement ever changes them.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property int $booking_id
 * @property string $status
 * @property ?string $resolution
 * @property string $cause
 * @property string $source
 * @property array<string, mixed> $context
 * @property int $original_resource_id
 * @property ?int $reassigned_resource_id
 * @property int $revision
 * @property CarbonImmutable $detected_at
 * @property ?CarbonImmutable $reopened_at
 * @property ?CarbonImmutable $resolved_at
 */
class SchedulingConflict extends Model
{
    public const OPEN = 'open';

    public const AWAITING_CUSTOMER = 'awaiting_customer';

    public const RESOLVED = 'resolved';

    public const SAME_TIME_REASSIGNED = 'same_time_reassigned';

    public const CUSTOMER_ACCEPTED = 'customer_accepted';

    public const BOOKING_CLOSED = 'booking_closed';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'detected_at' => 'immutable_datetime',
            'reopened_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return HasMany<ConflictProposal, $this> */
    public function proposals(): HasMany
    {
        return $this->hasMany(ConflictProposal::class, 'conflict_id')->orderByDesc('id');
    }

    public function isUnresolved(): bool
    {
        return $this->status !== self::RESOLVED;
    }
}
