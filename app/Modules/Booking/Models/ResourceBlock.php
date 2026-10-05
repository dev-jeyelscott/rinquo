<?php

namespace App\Modules\Booking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A staff-set operational block of one physical resource over [starts_at,
 * ends_at). An active block claims the whole resource, so availability, walk-in
 * gaps and assignment all treat it as unavailable.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property int $physical_resource_id
 * @property CarbonImmutable $starts_at
 * @property CarbonImmutable $ends_at
 * @property string $reason
 * @property int $created_by_user_id
 * @property ?CarbonImmutable $released_at
 */
class ResourceBlock extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'released_at' => 'immutable_datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }
}
