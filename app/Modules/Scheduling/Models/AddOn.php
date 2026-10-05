<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property int $price_centavos
 * @property int $duration_minutes
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class AddOn extends Model
{
    use Archivable;

    protected $fillable = ['name', 'price_centavos', 'duration_minutes', 'is_active'];

    /** @return BelongsToMany<VehicleType, $this> */
    public function vehicleTypes(): BelongsToMany
    {
        return $this->belongsToMany(VehicleType::class, 'add_on_vehicle_options')->withPivot('organization_id');
    }

    /** @return BelongsToMany<Service, $this> */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'service_add_ons')->withPivot('organization_id');
    }
}
