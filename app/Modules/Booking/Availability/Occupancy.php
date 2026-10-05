<?php

namespace App\Modules\Booking\Availability;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Models\ResourceBlock;
use Carbon\CarbonImmutable;

/**
 * Reads the live capacity claims on a set of physical resources over a window.
 *
 * Live claims are active unexpired holds, active unexpired scheduling-conflict
 * proposals (a temporary claim beside the original booking, never a booking),
 * confirmed bookings, unexpired pending-approval bookings and active resource
 * blocks. A booking claims its
 * effective resource (actual assignment, else planned) until its effective
 * capacity end ({@see Booking::capacityEndsAt()}): an overrun keeps the
 * resource until completion, completion keeps only the buffer, and a
 * confirmed no-show releases it. The immutable plan is never rewritten. Expiry is a time predicate, so capacity frees at
 * the expiry instant even when the sweeper has not run. Both queries are
 * bounded by organization, resource ids and the window. A browser session's
 * own holds can be excluded (by token hash) for read-only availability, since
 * placing a hold replaces that session's earlier ones.
 */
final class Occupancy
{
    /** Units an active block claims: more than any resource can hold, so nothing fits. */
    public const BLOCK_UNITS = 32767;

    /**
     * @param  list<int>  $resourceIds
     * @param  list<int>  $excludeBookingIds  bookings whose claims are being re-planned and must not count
     * @return array<int, list<Claim>> claims keyed by physical resource id
     */
    public function claims(
        int $organizationId,
        array $resourceIds,
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $now,
        ?int $excludeHoldId = null,
        ?string $excludeSessionHash = null,
        ?int $excludeBookingId = null,
        array $excludeBookingIds = [],
        ?int $excludeProposalId = null,
    ): array {
        if ($resourceIds === []) {
            return [];
        }

        $claims = array_fill_keys($resourceIds, []);

        $holds = Hold::query()
            ->where('organization_id', $organizationId)
            ->whereIn('physical_resource_id', $resourceIds)
            ->where('status', Hold::ACTIVE)
            ->where('expires_at', '>', $now)
            ->where('scheduled_start_at', '<', $to)
            ->where('occupied_end_at', '>', $from)
            ->when($excludeHoldId !== null, fn ($query) => $query->where('id', '!=', $excludeHoldId))
            ->when($excludeSessionHash !== null, fn ($query) => $query->where('session_token_hash', '!=', $excludeSessionHash))
            ->get(['physical_resource_id', 'scheduled_start_at', 'occupied_end_at', 'units']);

        foreach ($holds as $hold) {
            $claims[$hold->physical_resource_id][] = new Claim($hold->scheduled_start_at, $hold->occupied_end_at, $hold->units);
        }

        $bookings = Booking::query()
            ->where('organization_id', $organizationId)
            ->where(fn ($query) => $query->whereIn('actual_resource_id', $resourceIds)
                ->orWhere(fn ($planned) => $planned->whereNull('actual_resource_id')->whereIn('physical_resource_id', $resourceIds)))
            ->where(function ($query) use ($now): void {
                $query->where('status', Booking::CONFIRMED)
                    ->orWhere(fn ($pending) => $pending->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '>', $now));
            })
            // In-service work can outrun its plan, so it is always read and then clipped in PHP.
            ->where(fn ($query) => $query->where('operational_state', Booking::IN_SERVICE)
                ->orWhere(fn ($planned) => $planned->where('scheduled_start_at', '<', $to)->whereRaw('COALESCE(capacity_release_at, occupied_end_at) > ?', [$from])))
            ->when($excludeBookingId !== null, fn ($query) => $query->where('id', '!=', $excludeBookingId))
            ->when($excludeBookingIds !== [], fn ($query) => $query->whereNotIn('id', $excludeBookingIds))
            ->get();

        foreach ($bookings as $booking) {
            $start = $booking->started_at !== null ? $booking->scheduled_start_at->min($booking->started_at) : $booking->scheduled_start_at;
            $end = $booking->capacityEndsAt($now);
            if ($start < $to && $end > $from) {
                $claims[$booking->claimedResourceId()][] = new Claim($start, $end, $booking->consumption_units);
            }
        }

        $proposals = ConflictProposal::query()
            ->where('organization_id', $organizationId)
            ->whereIn('physical_resource_id', $resourceIds)
            ->where('status', ConflictProposal::ACTIVE)
            ->where('expires_at', '>', $now)
            ->where('proposed_start_at', '<', $to)
            ->where('occupied_end_at', '>', $from)
            ->when($excludeProposalId !== null, fn ($query) => $query->where('id', '!=', $excludeProposalId))
            ->get(['physical_resource_id', 'proposed_start_at', 'occupied_end_at', 'units']);

        foreach ($proposals as $proposal) {
            $claims[$proposal->physical_resource_id][] = new Claim($proposal->proposed_start_at, $proposal->occupied_end_at, $proposal->units);
        }

        $blocks = ResourceBlock::query()
            ->where('organization_id', $organizationId)
            ->whereIn('physical_resource_id', $resourceIds)
            ->whereNull('released_at')
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->get(['physical_resource_id', 'starts_at', 'ends_at']);

        foreach ($blocks as $block) {
            $claims[$block->physical_resource_id][] = new Claim($block->starts_at, $block->ends_at, self::BLOCK_UNITS);
        }

        return $claims;
    }
}
