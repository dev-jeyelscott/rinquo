<?php

namespace App\Modules\Subscription\Actions;

use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Models\WebhookEvent;
use App\Modules\Subscription\PayMongo\PayMongoException;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Decision 108: inside a live renewal window an Owner always has an open
 * 24-hour renewal request. When the previous one expired (or never got its
 * Payment Intent), this run creates the next one through the same idempotent
 * path the Owner's button uses (one open request per organization is a database
 * guarantee). It never attaches a QR (a 30-minute QR would be stale before the
 * Owner opens Billing) and never changes entitlement.
 *
 * A live window runs from seven days before access ends (the largest reminder
 * offset) to the end of the paid grace, or to the end of an unpaid trial.
 * Provider calls are bounded: one attempt per organization per run, exponential
 * backoff per request, a per-run cap and a circuit breaker after consecutive
 * provider failures.
 */
final class RegenerateRenewalRequests
{
    public const MAX_PER_RUN = 200;

    public const BREAKER = 5;

    private const BACKOFF_BASE_MINUTES = 15;

    private const BACKOFF_MAX_MINUTES = 120;

    public function __construct(private readonly OpenRenewalRequest $renewals, private readonly PayMongoGateway $gateway) {}

    /** @return array{candidates: int, created: int, skipped_window: int, skipped_pending_settlement: int, provider_failed: int, stopped: bool} */
    public function handle(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $counts = ['candidates' => 0, 'created' => 0, 'skipped_window' => 0, 'skipped_pending_settlement' => 0, 'provider_failed' => 0, 'stopped' => false];

        if (! $this->gateway->isConfigured()) {
            return $counts;
        }

        $consecutiveFailures = 0;

        foreach ($this->candidates($now) as $subscription) {
            $counts['candidates']++;

            // Re-read the instants: the candidate query is a cheap filter, not the decision.
            $current = Subscription::query()->where('organization_id', $subscription->organization_id)->first();
            if ($current === null || ! self::inLiveWindow($current, $now)) {
                $counts['skipped_window']++;

                continue;
            }
            if ($this->settlementPending($current->organization_id)) {
                $counts['skipped_pending_settlement']++;

                continue;
            }

            $organization = Organization::query()->find($current->organization_id);
            if ($organization === null) {
                continue;
            }

            $request = null;
            try {
                $request = $this->renewals->ensureRequest($organization, null);
                $this->renewals->ensureIntent($request);
                $this->recordSuccess($request);
                $counts['created']++;
                $consecutiveFailures = 0;
            } catch (PayMongoException $exception) {
                // PayMongoException messages are fixed, secret-free sentences (no keys, bodies or QR data).
                report($exception);
                if ($request !== null) {
                    $this->recordFailure($request, $now);
                }
                $counts['provider_failed']++;
                if (++$consecutiveFailures >= self::BREAKER) {
                    $counts['stopped'] = true;
                    break;
                }
            }
        }

        Log::info('subscriptions.regenerate_requests', $counts);

        return $counts;
    }

    /** The live window: seven days before access ends until grace (paid) or the trial (unpaid) ends. */
    public static function inLiveWindow(Subscription $subscription, CarbonImmutable $now): bool
    {
        $opensAt = $subscription->accessEndsAt()->subDays(PlanTerms::current()->renewalWindowDays());
        $closesAt = $subscription->paid_until !== null ? $subscription->grace_ends_at : $subscription->trial_ends_at;

        return $now >= $opensAt && $now < $closesAt;
    }

    /**
     * Subscriptions inside a window with no live request that has its intent, and not in backoff.
     * Closed organizations are excluded. Bounded by MAX_PER_RUN; the rest wait for the next run.
     *
     * @return Collection<int, Subscription>
     */
    private function candidates(CarbonImmutable $now)
    {
        $days = PlanTerms::current()->renewalWindowDays();

        return Subscription::query()
            ->whereRaw("GREATEST(trial_ends_at, COALESCE(paid_until, trial_ends_at)) - (? * interval '1 day') <= ?", [$days, $now])
            ->whereRaw('? < CASE WHEN paid_until IS NOT NULL THEN grace_ends_at ELSE trial_ends_at END', [$now])
            ->whereNotExists(fn ($closure) => $closure->selectRaw('1')->from('organization_closures')
                ->whereColumn('organization_closures.organization_id', 'subscriptions.organization_id')->whereNull('organization_closures.recovered_at'))
            ->whereNotExists(fn ($open) => $open->selectRaw('1')->from('subscription_payment_requests as r')
                ->whereColumn('r.organization_id', 'subscriptions.organization_id')->where('r.status', PaymentRequest::OPEN)
                ->where(fn ($live) => $live->where(fn ($ready) => $ready->where('r.expires_at', '>', $now)->whereNotNull('r.provider_payment_intent_id'))
                    ->orWhere('r.next_provider_attempt_at', '>', $now)))
            ->orderBy('id')
            ->limit(self::MAX_PER_RUN)
            ->get();
    }

    /** An unprocessed paid receipt for one of the organization's intents may still extend entitlement. */
    private function settlementPending(int $organizationId): bool
    {
        return WebhookEvent::query()->where('status', WebhookEvent::RECEIVED)
            ->whereIn('provider_payment_intent_id', PaymentRequest::query()->where('organization_id', $organizationId)->whereNotNull('provider_payment_intent_id')->select('provider_payment_intent_id'))
            ->exists();
    }

    private function recordSuccess(PaymentRequest $request): void
    {
        if ($request->provider_attempts > 0 || $request->next_provider_attempt_at !== null || $request->last_provider_error !== null) {
            PaymentRequest::query()->whereKey($request->id)->update(['provider_attempts' => 0, 'next_provider_attempt_at' => null, 'last_provider_error' => null, 'updated_at' => now()]);
        }
    }

    private function recordFailure(PaymentRequest $request, CarbonImmutable $now): void
    {
        $attempts = $request->provider_attempts + 1;
        $delay = min(self::BACKOFF_BASE_MINUTES * (2 ** ($attempts - 1)), self::BACKOFF_MAX_MINUTES);

        PaymentRequest::query()->whereKey($request->id)->update([
            'provider_attempts' => $attempts,
            'next_provider_attempt_at' => $now->addMinutes($delay),
            'last_provider_error' => 'provider_unavailable',
            'updated_at' => $now,
        ]);
    }
}
