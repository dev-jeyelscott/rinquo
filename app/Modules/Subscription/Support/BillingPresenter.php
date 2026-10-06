<?php

namespace App\Modules\Subscription\Support;

use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Subscription\Models\Payment;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;

/**
 * Builds the props the Owner UI renders: the shared entitlement summary (every
 * Owner and Staff page) and the billing page. It only presents server truth:
 * amounts, dates and QR data come from the database, never from the browser.
 */
final class BillingPresenter
{
    public function __construct(private readonly AccessResolver $access, private readonly PayMongoGateway $gateway) {}

    /** @return array<string, mixed> */
    public function summary(Organization $organization): array
    {
        $access = $this->access->for($organization);
        $iso = fn (?CarbonImmutable $at): ?string => $at?->toIso8601String();

        return [
            'state' => $access->entitlement,
            'trialEndsAt' => $iso($access->trialEndsAt),
            'paidUntil' => $iso($access->paidUntil),
            'graceEndsAt' => $iso($access->graceEndsAt),
            'closed' => $access->isClosed(),
            'closure' => $access->closure === null ? null : [
                'state' => $access->closure->stateAt($access->at),
                'requestedAt' => $iso($access->closure->requested_at),
                'recoverableUntil' => $iso($access->closure->recoverable_until),
                'deletionEligibleAt' => $iso($access->closure->deletion_eligible_at),
            ],
            'acceptsNewBookings' => $access->acceptsNewBookings(),
            'allowsConfigurationWrites' => $access->allowsConfigurationWrites(),
        ];
    }

    /** @return array<string, mixed> */
    public function billing(Organization $organization): array
    {
        $now = CarbonImmutable::now();
        $terms = PlanTerms::current();

        $open = PaymentRequest::query()->where('organization_id', $organization->id)->where('status', PaymentRequest::OPEN)->where('expires_at', '>', $now)->first();
        $last = PaymentRequest::query()->where('organization_id', $organization->id)->orderByDesc('id')->first();
        $payment = Payment::query()->where('organization_id', $organization->id)->orderByDesc('id')->first();

        return [
            'plan' => ['amountCentavos' => $terms->amountCentavos, 'currency' => $terms->currency, 'requestLifetimeHours' => $terms->requestLifetimeHours],
            'billingAvailable' => $this->gateway->isConfigured(),
            'request' => $open === null ? null : [
                'id' => $open->public_id,
                'amountCentavos' => $open->amount_centavos,
                'expiresAt' => $open->expires_at->toIso8601String(),
                // The QR image is served only for the authorized organization's active request.
                'qrImage' => $open->qr_image !== null && $open->qr_expires_at !== null && $open->qr_expires_at > $now ? $open->qr_image : null,
                'qrExpiresAt' => $open->qr_expires_at?->toIso8601String(),
                'providerError' => $open->last_provider_error !== null,
            ],
            // Absence of payment is not the same as a system failure: an expired request is only that.
            'lastRequestExpiredAt' => $open === null && $last !== null && $last->status !== PaymentRequest::PAID ? $last->expires_at->toIso8601String() : null,
            'lastPayment' => $payment === null ? null : [
                'amountCentavos' => $payment->amount_centavos,
                'paidAt' => $payment->paid_at->toIso8601String(),
                'paidUntil' => $payment->paid_until->toIso8601String(),
            ],
            'closureRecoveryDays' => $terms->closureRecoveryDays,
        ];
    }
}
