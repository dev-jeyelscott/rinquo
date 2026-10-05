<?php

namespace App\Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Model;

/** Branch-local opening interval; times are wall-clock values (HH:MM:SS).
 *
 * @property int $id
 * @property int $organization_id
 * @property int $branch_id
 * @property int $weekday
 * @property string $opens_at
 * @property string $closes_at
 */
class BranchWeeklyHour extends Model
{
    protected $fillable = ['organization_id', 'branch_id', 'weekday', 'opens_at', 'closes_at'];
}
