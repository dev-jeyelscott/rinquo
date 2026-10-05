<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $branch_id
 * @property string $name
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class ResourceType extends Model
{
    use Archivable;

    protected $fillable = ['name', 'is_active'];

    /** @return HasMany<PhysicalResource, $this> */
    public function resources(): HasMany
    {
        return $this->hasMany(PhysicalResource::class);
    }
}
