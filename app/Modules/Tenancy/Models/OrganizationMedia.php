<?php

namespace App\Modules\Tenancy\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $kind
 * @property string $storage_key
 * @property string $mime_type
 * @property string $alt_text
 * @property int $sort_order
 * @property ?CarbonImmutable $archived_at
 */
class OrganizationMedia extends Model
{
    public const LOGO = 'logo';

    public const HERO = 'hero';

    public const GALLERY = 'gallery';

    public const KINDS = [self::LOGO, self::HERO, self::GALLERY];

    protected $table = 'organization_media';

    protected $fillable = ['organization_id', 'kind', 'storage_key', 'mime_type', 'alt_text', 'sort_order'];

    protected $hidden = ['storage_key'];

    protected function casts(): array
    {
        return ['archived_at' => 'immutable_datetime'];
    }

    /**
     * @param  Builder<OrganizationMedia>  $query
     * @return Builder<OrganizationMedia>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }
}
