<?php

namespace App\Modules\Tenancy\Models;

use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $organization_id
 * @property int $user_id
 * @property string $role
 * @property bool $is_active
 */
class Membership extends Model
{
    public const OWNER = 'owner';

    public const STAFF = 'staff';

    protected $table = 'organization_memberships';

    protected $fillable = ['organization_id', 'user_id', 'role'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
