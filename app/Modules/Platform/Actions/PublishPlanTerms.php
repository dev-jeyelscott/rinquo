<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\PlanTermVersion;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Publishes a new immutable version of the global plan terms. The version must take effect
 * now or later and after every earlier version, so history is never rewritten and the
 * ordering is unambiguous. Issued requests and current paid periods keep their snapshots.
 */
final class PublishPlanTerms
{
    public function handle(PlatformAdmin $actor, int $amountCentavos, int $trialDays, int $graceDays, CarbonImmutable $effectiveAt, string $reason): PlanTermVersion
    {
        // Persist the absolute instant in UTC: Eloquent writes the wall-clock digits of the value's own zone.
        $effectiveAt = $effectiveAt->utc();

        return DB::transaction(function () use ($actor, $amountCentavos, $trialDays, $graceDays, $effectiveAt, $reason): PlanTermVersion {
            DB::select('select pg_advisory_xact_lock(?)', [8_000_002]);

            $latest = PlanTermVersion::query()->max('effective_at');
            if ($effectiveAt < CarbonImmutable::now()->startOfMinute()) {
                throw ValidationException::withMessages(['effective_at' => 'New terms cannot take effect in the past.']);
            }
            if ($latest !== null && $effectiveAt <= CarbonImmutable::parse($latest)) {
                throw ValidationException::withMessages(['effective_at' => 'New terms must take effect after the latest published version.']);
            }

            $version = PlanTermVersion::query()->create([
                'amount_centavos' => $amountCentavos,
                'trial_days' => $trialDays,
                'grace_days' => $graceDays,
                'effective_at' => $effectiveAt,
                'created_by_admin_id' => $actor->id,
                'reason' => $reason,
            ]);

            PlatformAudit::record('plan_terms.published', 'success', $actor, 'plan_term_version', $version->id, [
                'plan_term_version_id' => $version->id, 'amount_centavos' => $amountCentavos, 'trial_days' => $trialDays,
                'grace_days' => $graceDays, 'effective_at' => $effectiveAt->toIso8601String(),
            ]);

            return $version;
        });
    }
}
