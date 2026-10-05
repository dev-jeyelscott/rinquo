<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class VehicleType extends Model
{
    use Archivable;

    protected $fillable = ['name', 'is_active'];
}
