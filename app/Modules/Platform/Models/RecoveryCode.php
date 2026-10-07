<?php

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Model;

/** Hash-only, single-use recovery material. */
class RecoveryCode extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'platform_admin_recovery_codes';

    protected $fillable = ['platform_admin_id', 'code_digest'];

    protected function casts(): array
    {
        return ['consumed_at' => 'immutable_datetime'];
    }
}
