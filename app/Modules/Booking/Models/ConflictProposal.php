<?php

namespace App\Modules\Booking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A staff-sent replacement time for a conflicted booking. While active it is a
 * temporary claim on its resource (read by Occupancy until it expires), never a
 * confirmed booking: only the customer's acceptance creates the replacement.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property int $conflict_id
 * @property int $booking_id
 * @property int $physical_resource_id
 * @property int $resource_type_id
 * @property int $units
 * @property CarbonImmutable $proposed_start_at
 * @property CarbonImmutable $proposed_service_end_at
 * @property CarbonImmutable $occupied_end_at
 * @property string $status
 * @property CarbonImmutable $expires_at
 * @property int $created_by_user_id
 * @property ?CarbonImmutable $responded_at
 * @property ?int $replacement_booking_id
 * @property int $revision
 */
class ConflictProposal extends Model
{
    public const ACTIVE = 'active';

    public const ACCEPTED = 'accepted';

    public const DECLINED = 'declined';

    public const EXPIRED = 'expired';

    public const WITHDRAWN = 'withdrawn';

    public const REPLACED = 'replaced';

    protected $table = 'scheduling_conflict_proposals';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'proposed_start_at' => 'immutable_datetime',
            'proposed_service_end_at' => 'immutable_datetime',
            'occupied_end_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
            'responded_at' => 'immutable_datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /** Active and not past its deadline: the instant it expires its capacity frees, even before the sweeper runs. */
    public function isOpenForResponse(?CarbonImmutable $now = null): bool
    {
        return $this->status === self::ACTIVE && $this->expires_at > ($now ?? CarbonImmutable::now());
    }
}
