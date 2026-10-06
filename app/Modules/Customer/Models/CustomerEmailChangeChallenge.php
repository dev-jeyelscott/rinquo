<?php

namespace App\Modules\Customer\Models;

use Illuminate\Database\Eloquent\Model;

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
