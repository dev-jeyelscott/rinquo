<?php

namespace App\Modules\Platform\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $email
 * @property int $invited_by_admin_id
 * @property CarbonImmutable $expires_at
 */
class AdminInvitation extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'platform_admin_invitations';

    protected $fillable = ['email', 'token_digest', 'invited_by_admin_id', 'expires_at'];

    protected $hidden = ['token_digest'];

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'consumed_at' => 'immutable_datetime', 'revoked_at' => 'immutable_datetime'];
    }

    public static function digest(string $token): string
    {
        return hash('sha256', $token);
    }
}
