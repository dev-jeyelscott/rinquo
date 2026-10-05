<?php

namespace App\Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Model;

/** Branch-local weekly interval during which a service may be offered.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $service_id
 * @property int $weekday
 * @property string $starts_at
 * @property string $ends_at
 */
class ServiceWindow extends Model
{
    protected $fillable = ['organization_id', 'service_id', 'weekday', 'starts_at', 'ends_at'];
}
