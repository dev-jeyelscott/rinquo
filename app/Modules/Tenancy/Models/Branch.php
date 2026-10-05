<?php

namespace App\Modules\Tenancy\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The sole branch of an organization (one per organization in the MVP).
 * Calendar values on branch-owned records are local wall-clock values in
 * {@see self::TIMEZONE}; they are never stored as fake UTC instants.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $name
 * @property ?string $address_line
 * @property ?string $city
 * @property ?string $phone
 * @property string $timezone
 * @property bool $is_active
 */
class Branch extends Model
{
    public const TIMEZONE = 'Asia/Manila';

    protected $fillable = ['name', 'address_line', 'city', 'phone'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
