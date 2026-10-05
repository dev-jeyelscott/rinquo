<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Scheduling\Models\PhysicalResource;

/** Staff-safe presentation of an impact plan: counts plus the affected bookings, never raw models. */
final class ImpactSummary
{
    /** @return array<string, mixed> */
    public static function of(ImpactPlan $plan, int $organizationId, string $token, bool $preview): array
    {
        $names = PhysicalResource::query()->where('organization_id', $organizationId)->pluck('name', 'id');

        return [
            'affected' => $plan->affected(),
            'reassigned' => $plan->reassigned(),
            'conflicts' => $plan->conflicts(),
            'token' => $token,
            'preview' => $preview,
            'bookings' => array_map(fn (ImpactItem $item): array => [
                'id' => $item->booking->public_id,
                'customerName' => $item->booking->contact_name,
                'serviceName' => $item->booking->service_name,
                'startAt' => $item->booking->scheduled_start_at->utc()->toIso8601String(),
                'timezone' => $item->booking->branch_timezone,
                'outcome' => $item->outcome,
                'cause' => $item->cause,
                'fromResource' => $names[$item->fromResourceId] ?? null,
                'toResource' => $item->toResourceId === null ? null : ($names[$item->toResourceId] ?? null),
            ], array_slice($plan->items, 0, 50)),
            'truncated' => max(0, $plan->affected() - 50),
        ];
    }
}
