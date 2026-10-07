<?php

namespace App\Modules\Platform\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One read-only, organization-bound, time-boxed support window for one platform admin.
 *
 * @property string $id
 * @property int $platform_admin_id
 * @property int $organization_id
 * @property int $target_user_id
 * @property string $reason
 * @property string $reference
 * @property CarbonImmutable $started_at
 * @property CarbonImmutable $expires_at
 * @property ?CarbonImmutable $ended_at
 */
class SupportSession extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['platform_admin_id', 'organization_id', 'target_user_id', 'reason', 'reference', 'started_at', 'expires_at', 'correlation_id'];

    protected function casts(): array
    {
        return ['started_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime'];
    }

    public function isLive(?CarbonImmutable $at = null): bool
    {
        return $this->ended_at === null && $this->expires_at > ($at ?? CarbonImmutable::now());
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<User, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    /** @return BelongsTo<PlatformAdmin, $this> */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'platform_admin_id');
    }
}
