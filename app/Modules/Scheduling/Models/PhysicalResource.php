<?php

namespace App\Modules\Scheduling\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $resource_type_id
 * @property string $name
 * @property int $capacity
 * @property bool $is_active
 * @property ?CarbonImmutable $archived_at
 */
class PhysicalResource extends Model
{
    use Archivable;

    protected $fillable = ['resource_type_id', 'name', 'capacity', 'is_active'];

    /** @return BelongsTo<ResourceType, $this> */
    public function resourceType(): BelongsTo
    {
        return $this->belongsTo(ResourceType::class);
    }
}
