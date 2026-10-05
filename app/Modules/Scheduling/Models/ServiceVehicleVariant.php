<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $service_id
 * @property int $vehicle_type_id
 * @property int $price_centavos
 * @property int $duration_minutes
 * @property int $buffer_minutes
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class ServiceVehicleVariant extends Model
{
    use Archivable;

    protected $fillable = ['service_id', 'vehicle_type_id', 'price_centavos', 'duration_minutes', 'buffer_minutes', 'is_active'];

    /** @return BelongsTo<Service, $this> */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /** @return BelongsTo<VehicleType, $this> */
    public function vehicleType(): BelongsTo
    {
        return $this->belongsTo(VehicleType::class);
    }

    /** @return HasMany<CapacityConsumption, $this> */
    public function consumptions(): HasMany
    {
        return $this->hasMany(CapacityConsumption::class);
    }
}
