<?php

namespace App\Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The Owner-set booking policy of one organization. Bookings snapshot the
 * values in force at confirmation, so changing the policy never rewrites them.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $approval_mode
 * @property int $slot_interval_minutes
 * @property int $min_notice_minutes
 * @property int $horizon_days
 * @property int $approval_window_minutes
 */
class BookingPolicy extends Model
{
    public const AUTO_CONFIRM = 'auto_confirm';

    public const STAFF_APPROVAL = 'staff_approval';

    public const APPROVAL_MODES = [self::AUTO_CONFIRM, self::STAFF_APPROVAL];

    public const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60];

    /** The allowlisted editable values (also the audit and snapshot keys). */
    public const FIELDS = ['approval_mode', 'slot_interval_minutes', 'min_notice_minutes', 'horizon_days', 'approval_window_minutes'];

    protected $fillable = self::FIELDS;

    protected function casts(): array
    {
        return [
            'slot_interval_minutes' => 'integer',
            'min_notice_minutes' => 'integer',
            'horizon_days' => 'integer',
            'approval_window_minutes' => 'integer',
        ];
    }

    public function requiresApproval(): bool
    {
        return $this->approval_mode === self::STAFF_APPROVAL;
    }

    /** @return array{slot_interval_minutes: int, min_notice_minutes: int, horizon_days: int, approval_window_minutes: int} */
    public function snapshot(): array
    {
        return [
            'slot_interval_minutes' => $this->slot_interval_minutes,
            'min_notice_minutes' => $this->min_notice_minutes,
            'horizon_days' => $this->horizon_days,
            'approval_window_minutes' => $this->approval_window_minutes,
        ];
    }

    /** @return array<string, int|string> */
    public function values(): array
    {
        return ['approval_mode' => $this->approval_mode] + $this->snapshot();
    }
}
