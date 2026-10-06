<?php

namespace App\Modules\Subscription\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\PayMongo\PayMongoException;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Creates or reuses the organization's open renewal request and makes sure it
 * has a current dynamic QR. The local request lives 24 hours; one provider QR
 * lives at most the configured lifetime (PayMongo allows 60 to 9000 seconds),
 * so an expired QR is refreshed against the same request.
 *
 * Network calls never run inside a transaction. The local request is created
 * first, and each provider step is persisted before the next, with idempotency
 * keys derived from the request id and QR generation, so a retry after an
 * uncertain response resumes instead of duplicating.
 */
final class OpenRenewalRequest
{
    public function __construct(private readonly PayMongoGateway $gateway) {}

    /** @param  bool  $refresh  true when the Owner explicitly asks for a fresh QR */
    public function handle(Organization $organization, ?User $actor, bool $refresh = false): PaymentRequest
    {
        if (! $this->gateway->isConfigured()) {
            throw ValidationException::withMessages(['billing' => 'Online renewal is not available right now. Your current access is unchanged. Try again later.']);
        }

        $request = $this->ensureRequest($organization, $actor);

        try {
            if ($request->provider_payment_intent_id === null) {
                $intentId = $this->gateway->createPaymentIntent($request, "rinquo-{$request->public_id}-intent");
                PaymentRequest::query()->whereKey($request->id)->whereNull('provider_payment_intent_id')->update(['provider_payment_intent_id' => $intentId]);
                $request->refresh();
            }

            $generation = $this->claimQrGeneration($request, $refresh);
            if ($generation !== null) {
                $this->attachQr($request, $generation);
            }
        } catch (PayMongoException $exception) {
            report($exception);
            PaymentRequest::query()->whereKey($request->id)->update(['last_provider_error' => 'provider_unavailable', 'updated_at' => now()]);

            throw ValidationException::withMessages(['billing' => 'The payment provider is not responding, so no QR code could be prepared. You have not been charged. Try again in a moment.']);
        }

        return $request->refresh();
    }

    private function ensureRequest(Organization $organization, ?User $actor): PaymentRequest
    {
        return DB::transaction(function () use ($organization, $actor): PaymentRequest {
            Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $subscription = Subscription::query()->where('organization_id', $organization->id)->firstOrFail();
            $now = CarbonImmutable::now();

            // A request past its local lifetime is closed; a payment that still arrives within its
            // payable window is honoured by the webhook, not by this status.
            PaymentRequest::query()->where('organization_id', $organization->id)->where('status', PaymentRequest::OPEN)
                ->where('expires_at', '<=', $now)->update(['status' => PaymentRequest::EXPIRED, 'updated_at' => $now]);

            $open = PaymentRequest::query()->where('organization_id', $organization->id)->where('status', PaymentRequest::OPEN)->first();
            if ($open !== null) {
                return $open;
            }

            $terms = PlanTerms::current();
            $request = new PaymentRequest;
            $request->forceFill([
                'public_id' => (string) Str::uuid(),
                'organization_id' => $organization->id,
                'subscription_id' => $subscription->id,
                'amount_centavos' => $terms->amountCentavos,
                'currency' => $terms->currency,
                'period_months' => 1,
                'provider_mode' => $this->gateway->mode(),
                'status' => PaymentRequest::OPEN,
                'expires_at' => $now->addHours($terms->requestLifetimeHours),
                'created_by_user_id' => $actor?->id,
            ])->save();

            return $request;
        });
    }

    /**
     * Under a short row lock, decides whether a (new) QR is needed and returns the generation to create.
     * Concurrent clicks are serialized, so only the first creates a QR.
     */
    private function claimQrGeneration(PaymentRequest $request, bool $refresh): ?int
    {
        return DB::transaction(function () use ($request, $refresh): ?int {
            $locked = PaymentRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $now = CarbonImmutable::now();

            if ($locked->status !== PaymentRequest::OPEN || $locked->expires_at <= $now) {
                return null;
            }

            $qrLive = $locked->qr_image !== null && $locked->qr_expires_at !== null && $locked->qr_expires_at > $now;
            if ($qrLive && ! ($refresh && $locked->qr_expires_at <= $now->addSeconds(PlanTerms::QR_MIN_SECONDS))) {
                return null;
            }

            $locked->forceFill(['qr_generation' => $locked->qr_generation + 1, 'qr_image' => null, 'qr_expires_at' => null, 'last_provider_error' => null])->save();

            return $locked->qr_generation;
        });
    }

    private function attachQr(PaymentRequest $request, int $generation): void
    {
        $request->refresh();
        $now = CarbonImmutable::now();
        $terms = PlanTerms::current();
        $remaining = max(PlanTerms::QR_MIN_SECONDS, (int) $now->diffInSeconds($request->expires_at, false));
        $seconds = min($terms->qrLifetimeSeconds, $remaining);

        $methodId = $this->gateway->createQrPaymentMethod($request, $seconds, "rinquo-{$request->public_id}-method-{$generation}");
        $image = $this->gateway->attachQr((string) $request->provider_payment_intent_id, $methodId, "rinquo-{$request->public_id}-attach-{$generation}");

        // Only the generation that asked for it may store the result: a newer one wins.
        PaymentRequest::query()->whereKey($request->id)->where('qr_generation', $generation)->update([
            'provider_payment_method_id' => $methodId,
            'qr_image' => $image,
            'qr_expires_at' => CarbonImmutable::now()->addSeconds($seconds),
            'updated_at' => now(),
        ]);
    }
}
