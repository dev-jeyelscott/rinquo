<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/** Replaces the weekly hours of one branch-local calendar date.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $branch_id
 * @property CarbonImmutable $local_date
 * @property bool $is_closed
 * @property ?string $opens_at
 * @property ?string $closes_at
 */
class BranchDateOverride extends Model
{
    protected $fillable = ['organization_id', 'branch_id', 'local_date', 'is_closed', 'opens_at', 'closes_at'];

    protected function casts(): array
    {
        return ['is_closed' => 'boolean', 'local_date' => 'date:Y-m-d'];
    }
}
