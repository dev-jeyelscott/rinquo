<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property ?string $description
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class Service extends Model
{
    use Archivable;

    protected $fillable = ['name', 'description', 'is_active'];

    /** @return HasMany<ServiceVehicleVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ServiceVehicleVariant::class);
    }

    /** @return HasMany<ServiceWindow, $this> */
    public function windows(): HasMany
    {
        return $this->hasMany(ServiceWindow::class);
    }

    /** @return BelongsToMany<AddOn, $this> */
    public function addOns(): BelongsToMany
    {
        return $this->belongsToMany(AddOn::class, 'service_add_ons')->withPivot('organization_id');
    }
}
