<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Conflicts\ConflictLedger;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent sweeper for scheduling conflicts. Capacity already frees at a
 * proposal's deadline through the occupancy time predicate; this records the
 * expiry, returns the conflict to Staff action (releasing only the proposal),
 * and closes conflicts whose booking is no longer live. Each organization is
 * processed under its row lock with conditional state moves, so it is safe to
 * run repeatedly or against a racing customer response; work per run is bounded.
 */
final class ExpireConflictProposals
{
    private const ORGANIZATIONS_PER_RUN = 200;

    private const ROWS_PER_ORGANIZATION = 500;

    /** @return array{expired: int, closed: int} */
    public function handle(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $expired = 0;
        $closed = 0;

        $organizationIds = ConflictProposal::query()->where('status', ConflictProposal::ACTIVE)->where('expires_at', '<=', $now)->distinct()->limit(self::ORGANIZATIONS_PER_RUN)->pluck('organization_id')
            ->merge(SchedulingConflict::query()->where('status', '!=', SchedulingConflict::RESOLVED)
                ->whereIn('booking_id', fn ($query) => $query->select('id')->from('bookings')->where(fn ($ended) => $ended
                    ->whereNotIn('status', [Booking::CONFIRMED, Booking::PENDING_APPROVAL])
                    ->orWhereNotIn('operational_state', [Booking::SCHEDULED, Booking::CHECKED_IN])
                    ->orWhere(fn ($pending) => $pending->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '<=', $now))))
                ->distinct()->limit(self::ORGANIZATIONS_PER_RUN)->pluck('organization_id'))
            ->unique();

        foreach ($organizationIds as $organizationId) {
            DB::transaction(function () use ($organizationId, $now, &$expired, &$closed): void {
                $organization = Organization::query()->whereKey($organizationId)->lockForUpdate()->first();
                if ($organization === null) {
                    return;
                }

                $due = ConflictProposal::query()->where('organization_id', $organizationId)->where('status', ConflictProposal::ACTIVE)->where('expires_at', '<=', $now)
                    ->orderBy('id')->limit(self::ROWS_PER_ORGANIZATION)->lockForUpdate()->get();
                foreach ($due as $proposal) {
                    $conflict = SchedulingConflict::query()->where('organization_id', $organizationId)->whereKey($proposal->conflict_id)->lockForUpdate()->first();
                    ConflictLedger::endProposal($proposal, ConflictProposal::EXPIRED, $now);
                    if ($conflict !== null && $conflict->status === SchedulingConflict::AWAITING_CUSTOMER) {
                        ConflictLedger::move($conflict, SchedulingConflict::OPEN, 'proposal_expired', null, 'system', $proposal, [], null, $now);
                    }
                    $expired++;
                    $booking = Booking::query()->where('organization_id', $organizationId)->whereKey($proposal->booking_id)->first();
                    if ($booking !== null) {
                        ConflictLedger::nudgeCustomer($booking);
                    }
                }

                $ended = Booking::query()->where('organization_id', $organizationId)
                    ->whereIn('id', SchedulingConflict::query()->where('organization_id', $organizationId)->where('status', '!=', SchedulingConflict::RESOLVED)->select('booking_id'))
                    ->where(fn ($query) => $query->whereNotIn('status', [Booking::CONFIRMED, Booking::PENDING_APPROVAL])
                        ->orWhereNotIn('operational_state', [Booking::SCHEDULED, Booking::CHECKED_IN])
                        ->orWhere(fn ($pending) => $pending->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '<=', $now)))
                    ->orderBy('id')->limit(self::ROWS_PER_ORGANIZATION)->get();
                foreach ($ended as $booking) {
                    ConflictLedger::closeForBooking($organization, $booking, null, 'system');
                    $closed++;
                }
            });
        }

        return ['expired' => $expired, 'closed' => $closed];
    }
}
