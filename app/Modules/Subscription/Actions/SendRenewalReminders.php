<?php

namespace App\Modules\Subscription\Actions;

use App\Modules\Subscription\Mail\RenewalReminderMail;
use App\Modules\Subscription\Models\ReminderDelivery;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Support\OwnerMail;
use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Throwable;

/**
 * The idempotent lifecycle run. For every organization whose access ends within
 * the largest reminder offset it opens (or reuses) the 24-hour renewal request
 * and sends ONE Owner email for the tightest threshold now crossed (7, 3 or 1
 * day). Thresholds missed by a late run are recorded as skipped, so catching up
 * never sends a storm. The unique (organization, entitlement cycle, offset) row
 * is the dedupe; an early renewal moves the cycle and opens fresh thresholds.
 * It reads and writes no restriction flag: restriction is derived from time.
 */
final class SendRenewalReminders
{
    private const BATCH = 200;

    public function __construct(private readonly OpenRenewalRequest $renewals) {}

    /** @return int the number of reminder emails queued */
    public function handle(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();
        $offsets = PlanTerms::current()->reminderOffsetsDays; // descending
        $horizon = $now->addDays($offsets[0]);
        $sent = 0;

        Subscription::query()
            ->whereRaw('GREATEST(trial_ends_at, COALESCE(paid_until, trial_ends_at)) > ?', [$now])
            ->whereRaw('GREATEST(trial_ends_at, COALESCE(paid_until, trial_ends_at)) <= ?', [$horizon])
            ->whereNotExists(fn ($closure) => $closure->selectRaw('1')->from('organization_closures')
                ->whereColumn('organization_closures.organization_id', 'subscriptions.organization_id')->whereNull('organization_closures.recovered_at'))
            ->orderBy('id')
            ->chunkById(self::BATCH, function ($subscriptions) use ($now, $offsets, &$sent): void {
                foreach ($subscriptions as $subscription) {
                    $sent += $this->remind($subscription, $now, $offsets) ? 1 : 0;
                }
            });

        return $sent;
    }

    /** @param  list<int>  $offsets */
    private function remind(Subscription $subscription, CarbonImmutable $now, array $offsets): bool
    {
        $endsAt = $subscription->accessEndsAt();
        $crossed = array_values(array_filter($offsets, fn (int $days): bool => $now >= $endsAt->subDays($days)));
        if ($crossed === []) {
            return false;
        }

        $target = min($crossed);
        $key = ['organization_id' => $subscription->organization_id, 'entitlement_ends_at' => $endsAt];

        foreach ($crossed as $days) {
            if ($days !== $target) {
                ReminderDelivery::query()->insertOrIgnore($key + ['offset_days' => $days, 'status' => ReminderDelivery::SKIPPED, 'created_at' => $now, 'updated_at' => $now]);
            }
        }
        ReminderDelivery::query()->insertOrIgnore($key + ['offset_days' => $target, 'status' => ReminderDelivery::PENDING, 'created_at' => $now, 'updated_at' => $now]);

        // Claim atomically: only one run may move pending to sent. A failure releases the claim for the next run.
        $claimed = ReminderDelivery::query()->where($key)->where('offset_days', $target)->where('status', ReminderDelivery::PENDING)
            ->update(['status' => ReminderDelivery::SENT, 'sent_at' => $now, 'updated_at' => $now]);
        if ($claimed === 0) {
            return false;
        }

        $organization = Organization::query()->find($subscription->organization_id);
        if ($organization === null) {
            return false;
        }

        try {
            // A provider outage never blocks the reminder: the Owner can still reach the billing page.
            try {
                $this->renewals->handle($organization, null);
            } catch (Throwable $exception) {
                report($exception);
            }

            OwnerMail::queueOrFail($organization->id, fn (): RenewalReminderMail => new RenewalReminderMail($organization->id, $endsAt->toIso8601String(), $target));
        } catch (Throwable $exception) {
            report($exception);
            ReminderDelivery::query()->where($key)->where('offset_days', $target)->update(['status' => ReminderDelivery::PENDING, 'sent_at' => null]);

            return false;
        }

        return true;
    }
}
