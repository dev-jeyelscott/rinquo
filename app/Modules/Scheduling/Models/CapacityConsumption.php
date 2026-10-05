<?php

namespace App\Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $service_vehicle_variant_id
 * @property int $resource_type_id
 * @property int $units
 */
class CapacityConsumption extends Model
{
    protected $fillable = ['organization_id', 'service_vehicle_variant_id', 'resource_type_id', 'units'];
}
