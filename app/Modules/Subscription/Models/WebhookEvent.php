<?php

namespace App\Modules\Subscription\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A durable receipt of one signed provider event, keyed by the provider event
 * id. It keeps only the fields needed to process or audit the event.
 *
 * @property int $id
 * @property string $provider_event_id
 * @property string $event_type
 * @property bool $livemode
 * @property string $status
 * @property ?string $reason
 * @property ?int $organization_id
 * @property ?int $payment_request_id
 * @property ?string $provider_payment_intent_id
 * @property ?string $provider_payment_id
 * @property ?int $amount_centavos
 * @property ?string $currency
 * @property ?CarbonImmutable $paid_at
 */
class WebhookEvent extends Model
{
    public const RECEIVED = 'received';

    public const PROCESSED = 'processed';

    public const IGNORED = 'ignored';

    public const REJECTED = 'rejected';

    public $timestamps = false;

    protected $table = 'subscription_webhook_events';

    protected function casts(): array
    {
        return [
            'livemode' => 'boolean',
            'paid_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
            'processed_at' => 'immutable_datetime',
        ];
    }
}
