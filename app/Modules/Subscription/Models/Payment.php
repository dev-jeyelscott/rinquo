<?php

namespace App\Modules\Subscription\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A provider-confirmed payment and the entitlement period it bought. Append
 * only: its unique request and provider payment ids make the extension happen
 * exactly once.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $payment_request_id
 * @property string $provider_payment_id
 * @property int $amount_centavos
 * @property CarbonImmutable $paid_at
 * @property CarbonImmutable $period_starts_at
 * @property CarbonImmutable $paid_until
 * @property CarbonImmutable $grace_ends_at
 */
class Payment extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'subscription_payments';

    protected function casts(): array
    {
        return [
            'paid_at' => 'immutable_datetime',
            'period_starts_at' => 'immutable_datetime',
            'paid_until' => 'immutable_datetime',
            'grace_ends_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }
}
