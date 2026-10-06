<?php

namespace App\Modules\Subscription\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A renewal request: the amount, currency, period and local expiry are
 * snapshotted at creation. The QR is presentation data with its own, shorter
 * provider lifetime. Browser claims and screenshots are never payment evidence.
 *
 * @property int $id
 * @property string $public_id
 * @property int $organization_id
 * @property int $subscription_id
 * @property int $amount_centavos
 * @property string $currency
 * @property string $provider_mode
 * @property string $status
 * @property CarbonImmutable $expires_at
 * @property ?string $provider_payment_intent_id
 * @property ?string $provider_payment_method_id
 * @property ?string $qr_image
 * @property int $qr_generation
 * @property ?CarbonImmutable $qr_expires_at
 * @property ?string $last_provider_error
 * @property ?CarbonImmutable $paid_at
 * @property CarbonImmutable $created_at
 */
class PaymentRequest extends Model
{
    public const OPEN = 'open';

    public const PAID = 'paid';

    public const EXPIRED = 'expired';

    protected $table = 'subscription_payment_requests';

    protected $hidden = ['qr_image'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'qr_expires_at' => 'immutable_datetime',
            'paid_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** The latest instant at which a payment can still belong to this request. */
    public function payableUntil(): CarbonImmutable
    {
        return $this->qr_expires_at !== null && $this->qr_expires_at > $this->expires_at ? $this->qr_expires_at : $this->expires_at;
    }
}
