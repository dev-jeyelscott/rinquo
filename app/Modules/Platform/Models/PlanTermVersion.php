<?php

namespace App\Modules\Platform\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * Immutable, effective-dated subscription terms (a database trigger forbids update and delete).
 *
 * @property int $id
 * @property int $amount_centavos
 * @property int $trial_days
 * @property int $grace_days
 * @property CarbonImmutable $effective_at
 * @property string $reason
 */
class PlanTermVersion extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['amount_centavos', 'trial_days', 'grace_days', 'effective_at', 'created_by_admin_id', 'reason'];

    protected function casts(): array
    {
        return ['effective_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime'];
    }
}
