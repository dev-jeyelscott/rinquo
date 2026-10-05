<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Booking\Models\ConflictEvent;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Writes the confirmed outcome of an impact plan under the organization lock.
 * A same-time reassignment only moves the mutable planned/actual resource (the
 * snapshot, the time and the customer-visible state are untouched) and leaves a
 * resolved conflict row as its durable record; anything else becomes an open
 * conflict for Staff. Neither notifies the customer.
 */
final class ConflictRecorder
{
    /**
     * Appends an event to a conflict's append-only history.
     *
     * @param  array<string, mixed>  $details
     */
    public static function event(SchedulingConflict $conflict, string $event, ?string $from, string $to, ?User $actor, string $actorType, ?ConflictProposal $proposal = null, array $details = []): void
    {
        ConflictEvent::query()->create([
            'organization_id' => $conflict->organization_id, 'conflict_id' => $conflict->id, 'booking_id' => $conflict->booking_id,
            'proposal_id' => $proposal?->id, 'actor_user_id' => $actor?->id, 'actor_type' => $actorType,
            'event' => $event, 'from_status' => $from, 'to_status' => $to, 'details' => $details === [] ? null : $details,
        ]);
    }

    /** @return int number of new unresolved conflicts (what staff must be told about) */
    public function persist(ImpactPlan $plan, Organization $organization, ?User $actor, string $source, AuditTrail $audit, CarbonImmutable $now): int
    {
        $conflicts = 0;
        foreach ($plan->items as $item) {
            $booking = $item->booking;
            $reassigned = $item->outcome === ImpactItem::REASSIGNED;
            $conflict = SchedulingConflict::query()->create([
                'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'booking_id' => $booking->id,
                'status' => $reassigned ? SchedulingConflict::RESOLVED : SchedulingConflict::OPEN,
                'resolution' => $reassigned ? SchedulingConflict::SAME_TIME_REASSIGNED : null,
                'cause' => $item->cause, 'source' => $source,
                'context' => ['scheduled_start_at' => $booking->scheduled_start_at->utc()->toIso8601String(), 'from_resource_id' => $item->fromResourceId, 'to_resource_id' => $item->toResourceId],
                'original_resource_id' => $item->fromResourceId, 'reassigned_resource_id' => $item->toResourceId,
                'detected_at' => $now, 'resolved_at' => $reassigned ? $now : null, 'revision' => 1,
            ]);

            if ($reassigned) {
                // A staff-assigned bay moves with the plan; the immutable snapshot is never touched.
                $booking->forceFill([
                    'physical_resource_id' => $item->toResourceId,
                    'actual_resource_id' => $booking->actual_resource_id === null ? null : $item->toResourceId,
                    'operation_revision' => $booking->operation_revision + 1,
                ])->save();
            } else {
                $conflicts++;
            }

            self::event($conflict, $reassigned ? 'reassigned' : 'detected', null, $conflict->status, $actor, $actor === null ? 'system' : 'staff', null, [
                'cause' => $item->cause, 'from_resource_id' => $item->fromResourceId, 'to_resource_id' => $item->toResourceId, 'source' => $source,
            ]);
            $audit->record($reassigned ? 'scheduling_conflict.reassigned' : 'scheduling_conflict.detected', 'scheduling_conflict', $conflict->id, null, [
                'booking_id' => $booking->id, 'cause' => $item->cause, 'source' => $source, 'to_resource_id' => $item->toResourceId,
            ]);
        }

        return $conflicts;
    }
}
