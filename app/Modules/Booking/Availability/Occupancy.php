<?php

namespace App\Modules\Booking\Availability;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use Carbon\CarbonImmutable;

/**
 * Reads the live capacity claims on a set of physical resources over a window.
 *
 * Live claims are active unexpired holds, confirmed bookings and unexpired
 * pending-approval bookings. Expiry is a time predicate, so capacity frees at
 * the expiry instant even when the sweeper has not run. Both queries are
 * bounded by organization, resource ids and the window. A browser session's
 * own holds can be excluded (by token hash) for read-only availability, since
 * placing a hold replaces that session's earlier ones.
 */
final class Occupancy
{
    /**
     * @param  list<int>  $resourceIds
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
            ->whereIn('physical_resource_id', $resourceIds)
            ->where(function ($query) use ($now): void {
                $query->where('status', Booking::CONFIRMED)
                    ->orWhere(fn ($pending) => $pending->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '>', $now));
            })
            ->where('scheduled_start_at', '<', $to)
            ->where('occupied_end_at', '>', $from)
            ->get(['physical_resource_id', 'scheduled_start_at', 'occupied_end_at', 'consumption_units']);

        foreach ($bookings as $booking) {
            $claims[$booking->physical_resource_id][] = new Claim($booking->scheduled_start_at, $booking->occupied_end_at, $booking->consumption_units);
        }

        return $claims;
    }
}
