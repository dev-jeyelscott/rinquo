<?php

namespace App\Modules\Subscription\Actions;

use App\Modules\Subscription\Mail\PaymentConfirmedMail;
use App\Modules\Subscription\Models\Payment;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Models\WebhookEvent;
use App\Modules\Subscription\Support\OwnerMail;
use App\Modules\Subscription\Support\PaidThrough;
use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The only code that extends entitlement. It runs for one stored, signature
 * verified `payment.paid` receipt and, under the organization lock (the same
 * first lock every tenant mutation takes), validates the request ownership,
 * mode, amount, currency, intent and paid time, extends paid-through by one
 * Asia/Manila calendar month, refreshes grace and records the payment. A replay
 * or a concurrent duplicate finds the request already paid and changes nothing.
 * An inconsistent event is retained as rejected and never becomes access.
 */
final class ApplyPaidPayment
{
    /** Clock skew allowed before a request existed or after its payable window. */
    private const SKEW_SECONDS = 120;

    public function handle(int $webhookEventId): WebhookEvent
    {
        $mail = null;

        try {
            $event = DB::transaction(function () use ($webhookEventId, &$mail): WebhookEvent {
                $event = WebhookEvent::query()->whereKey($webhookEventId)->lockForUpdate()->firstOrFail();
                if ($event->status !== WebhookEvent::RECEIVED) {
                    return $event;
                }

                $request = PaymentRequest::query()->where('provider_payment_intent_id', $event->provider_payment_intent_id)->first();
                if ($request === null) {
                    return $this->settle($event, WebhookEvent::REJECTED, 'unknown_intent');
                }

                // Organization first, then subscription and request: the platform lock order.
                $organization = Organization::query()->whereKey($request->organization_id)->lockForUpdate()->firstOrFail();
                $subscription = Subscription::query()->where('organization_id', $organization->id)->lockForUpdate()->firstOrFail();
                $request = PaymentRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();

                $rejection = $this->rejection($event, $request);
                if ($rejection === 'duplicate') {
                    return $this->settle($event, WebhookEvent::PROCESSED, 'duplicate', $request);
                }
                if ($rejection !== null) {
                    return $this->settle($event, WebhookEvent::REJECTED, $rejection, $request);
                }

                $paidAt = $event->paid_at;
                $terms = PlanTerms::current();
                $anchor = PaidThrough::anchor($subscription->trial_ends_at, $subscription->paid_until, $paidAt);
                $paidUntil = PaidThrough::monthAfter($anchor);
                $graceEnds = PaidThrough::graceEnds($paidUntil, $terms->graceDays);
                $before = ['paid_until' => $subscription->paid_until?->toIso8601String(), 'grace_ends_at' => $subscription->grace_ends_at->toIso8601String()];

                $subscription->forceFill(['paid_until' => $paidUntil, 'grace_ends_at' => $graceEnds])->save();
                $request->forceFill(['status' => PaymentRequest::PAID, 'paid_at' => $paidAt, 'qr_image' => null, 'last_provider_error' => null])->save();

                $payment = new Payment;
                $payment->forceFill([
                    'organization_id' => $organization->id,
                    'subscription_id' => $subscription->id,
                    'payment_request_id' => $request->id,
                    'provider_payment_id' => $event->provider_payment_id,
                    'provider_payment_intent_id' => $event->provider_payment_intent_id,
                    'amount_centavos' => $request->amount_centavos,
                    'currency' => $request->currency,
                    'provider_mode' => $request->provider_mode,
                    'paid_at' => $paidAt,
                    'period_starts_at' => $anchor,
                    'paid_until' => $paidUntil,
                    'grace_ends_at' => $graceEnds,
                    'created_at' => CarbonImmutable::now(),
                ])->save();

                (new AuditTrail($organization, null))->record('subscription.payment_confirmed', 'subscription', $subscription->id, $before, [
                    'paid_until' => $paidUntil->toIso8601String(),
                    'grace_ends_at' => $graceEnds->toIso8601String(),
                    'payment_request' => $request->public_id,
                    'amount_centavos' => $request->amount_centavos,
                ]);

                $mail = [$organization->id, $payment->id];

                return $this->settle($event, WebhookEvent::PROCESSED, null, $request);
            });
        } catch (UniqueConstraintViolationException) {
            // Another worker recorded the same payment first. The transaction rolled back whole.
            $event = DB::transaction(fn (): WebhookEvent => $this->settle(
                WebhookEvent::query()->whereKey($webhookEventId)->lockForUpdate()->firstOrFail(), WebhookEvent::PROCESSED, 'duplicate',
            ));
        }

        if ($mail !== null) {
            OwnerMail::queue($mail[0], fn (): PaymentConfirmedMail => new PaymentConfirmedMail($mail[1]));
        }

        return $event;
    }

    /** Null when the event may extend entitlement, 'duplicate' for a replay, otherwise a safe reason. */
    private function rejection(WebhookEvent $event, PaymentRequest $request): ?string
    {
        if ($request->status === PaymentRequest::PAID) {
            return Payment::query()->where('payment_request_id', $request->id)->where('provider_payment_id', $event->provider_payment_id)->exists()
                ? 'duplicate'
                : 'request_already_paid';
        }

        $mode = $event->livemode ? 'live' : 'test';

        return match (true) {
            $request->provider_mode !== $mode => 'mode_mismatch',
            $event->amount_centavos !== $request->amount_centavos => 'amount_mismatch',
            $event->currency !== $request->currency => 'currency_mismatch',
            $event->paid_at === null,
            $event->paid_at < $request->created_at->subSeconds(self::SKEW_SECONDS),
            $event->paid_at > $request->payableUntil()->addSeconds(self::SKEW_SECONDS) => 'outside_payable_window',
            default => null,
        };
    }

    private function settle(WebhookEvent $event, string $status, ?string $reason, ?PaymentRequest $request = null): WebhookEvent
    {
        $event->forceFill([
            'status' => $status,
            'reason' => $reason,
            'organization_id' => $request?->organization_id,
            'payment_request_id' => $request?->id,
            'processed_at' => CarbonImmutable::now(),
        ])->save();

        return $event;
    }
}
