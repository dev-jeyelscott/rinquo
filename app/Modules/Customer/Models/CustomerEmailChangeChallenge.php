<?php

namespace App\Modules\Customer\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id
 * @property string $new_email
 * @property string $token_hash
 * @property string $code_hash
 * @property int $failed_attempts
 * @property CarbonImmutable $sent_at
 * @property CarbonImmutable $expires_at
 * @property ?CarbonImmutable $consumed_at
 */
class CustomerEmailChangeChallenge extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['sent_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'consumed_at' => 'immutable_datetime'];
    }

    public function isUsable(): bool
    {
        return $this->consumed_at === null && $this->expires_at->isFuture();
    }
}
