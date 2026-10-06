<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Stamps deletion eligibility on unrecovered closures whose recovery window
 * ended. Eligibility is only a marker for the later Platform Operations
 * retention procedure: this never deletes, anonymizes or deactivates anything,
 * and it reads no billing state. Idempotent and safe to rerun.
 */
final class MarkClosuresDeletionEligible
{
    private const BATCH = 100;

    /** @return int the number of closures marked eligible */
    public function handle(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();
        $marked = 0;

        OrganizationClosure::query()->whereNull('recovered_at')->whereNull('deletion_eligible_at')->where('recoverable_until', '<=', $now)
            ->orderBy('id')
            ->chunkById(self::BATCH, function ($closures) use ($now, &$marked): void {
                foreach ($closures as $candidate) {
                    $marked += DB::transaction(function () use ($candidate, $now): int {
                        $locked = Organization::query()->whereKey($candidate->organization_id)->lockForUpdate()->firstOrFail();
                        $closure = OrganizationClosure::query()->whereKey($candidate->id)->lockForUpdate()->firstOrFail();

                        // A recovery that won the race, or an earlier run, leaves nothing to do.
                        if ($closure->recovered_at !== null || $closure->deletion_eligible_at !== null || $closure->recoverable_until > $now) {
                            return 0;
                        }

                        $closure->forceFill(['deletion_eligible_at' => $now])->save();
                        (new AuditTrail($locked, null))->record('organization.deletion_eligible', 'organization', $locked->id, ['deletion_eligible' => false], ['deletion_eligible' => true]);

                        return 1;
                    });
                }
            });

        return $marked;
    }
}
