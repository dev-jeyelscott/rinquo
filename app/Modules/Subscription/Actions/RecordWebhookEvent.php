<?php

namespace App\Modules\Subscription\Actions;

use App\Modules\Subscription\Jobs\ProcessWebhookEvent;
use App\Modules\Subscription\Models\WebhookEvent;
use Carbon\CarbonImmutable;

/**
 * Durably receives one already-signature-verified PayMongo event before it is
 * acknowledged. The provider event id is unique, so redelivery never creates a
 * second receipt. Only `payment.paid` is actionable; every other type is kept
 * as ignored, so an out-of-order failure or update can never extend or revoke
 * entitlement. A wrong-mode or malformed envelope is retained as rejected.
 */
final class RecordWebhookEvent
{
    /** @param  array<string, mixed>  $payload  the decoded request body */
    public function handle(array $payload, string $configuredMode): ?WebhookEvent
    {
        $eventId = data_get($payload, 'data.id');
        $type = data_get($payload, 'data.attributes.type');
        $livemode = data_get($payload, 'data.attributes.livemode');

        if (! is_string($eventId) || $eventId === '' || strlen($eventId) > 80 || ! is_string($type) || strlen($type) > 80 || ! is_bool($livemode)) {
            return null;
        }

        $resource = data_get($payload, 'data.attributes.data');
        $attributes = is_array($resource) ? (array) ($resource['attributes'] ?? []) : [];
        $paidAt = $attributes['paid_at'] ?? null;
        $amount = $attributes['amount'] ?? null;
        $intent = $attributes['payment_intent_id'] ?? null;
        $paymentId = is_array($resource) ? ($resource['id'] ?? null) : null;
        $currency = $attributes['currency'] ?? null;

        [$status, $reason] = match (true) {
            $livemode !== ($configuredMode === 'live') => [WebhookEvent::REJECTED, 'mode_mismatch'],
            $type !== 'payment.paid' => [WebhookEvent::IGNORED, 'not_actionable'],
            ! is_string($paymentId) || ! is_string($intent) || ! is_int($amount) || ! is_string($currency) || ! is_int($paidAt) || ($attributes['status'] ?? null) !== 'paid' => [WebhookEvent::REJECTED, 'malformed_payment'],
            default => [WebhookEvent::RECEIVED, null],
        };

        $now = CarbonImmutable::now();

        // insertOrIgnore (ON CONFLICT DO NOTHING) keeps a redelivery race from raising inside a transaction.
        WebhookEvent::query()->insertOrIgnore([
            'provider_event_id' => $eventId,
            'event_type' => $type,
            'livemode' => $livemode,
            'status' => $status,
            'reason' => $reason,
            'provider_payment_intent_id' => is_string($intent) && strlen($intent) <= 80 ? $intent : null,
            'provider_payment_id' => is_string($paymentId) && strlen($paymentId) <= 80 ? $paymentId : null,
            'amount_centavos' => is_int($amount) && $amount > 0 ? $amount : null,
            'currency' => is_string($currency) && strlen($currency) === 3 ? strtoupper($currency) : null,
            'paid_at' => is_int($paidAt) ? CarbonImmutable::createFromTimestampUTC($paidAt) : null,
            'received_at' => $now,
            'processed_at' => $status === WebhookEvent::RECEIVED ? null : $now,
        ]);

        // A redelivery finds the first receipt; if that attempt never finished, process it again (the job is idempotent).
        $event = WebhookEvent::query()->where('provider_event_id', $eventId)->firstOrFail();

        if ($event->status === WebhookEvent::RECEIVED) {
            ProcessWebhookEvent::dispatch($event->id)->afterCommit();
        }

        return $event;
    }
}
