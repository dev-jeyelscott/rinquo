<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Shared transaction helpers for conflict actions: idempotent requests, locked
 * lookups and the state moves every action repeats. Lock order everywhere:
 * organization, then conflict, then proposal, then booking. Every method runs in
 * the caller's transaction.
 */
final class ConflictLedger
{
    /** @param  array<string, mixed>  $payload */
    public static function hash(User $actor, int $subjectId, string $operation, int $revision, array $payload = []): string
    {
        return hash('sha256', json_encode(['actor' => $actor->id, 'subject' => $subjectId, 'operation' => $operation, 'revision' => $revision, 'payload' => $payload], JSON_THROW_ON_ERROR));
    }

    /**
     * The recorded request for this key (non-null when an identical one already ran); a reused key for a different request is rejected.
     */
    public static function replayed(Organization $organization, User $actor, string $key, int $conflictId, string $operation, string $hash): ?\stdClass
    {
        $row = DB::table('scheduling_conflict_requests')->where('organization_id', $organization->id)->where('idempotency_key', $key)->first();
        if ($row === null) {
            return null;
        }
        if ($row->actor_user_id !== $actor->id || $row->conflict_id !== $conflictId || $row->operation !== $operation || ! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different action.']);
        }

        return $row;
    }

    public static function remember(Organization $organization, User $actor, string $key, int $conflictId, string $operation, string $hash, ?int $resultBookingId = null): void
    {
        DB::table('scheduling_conflict_requests')->insert([
            'organization_id' => $organization->id, 'conflict_id' => $conflictId, 'actor_user_id' => $actor->id, 'idempotency_key' => $key,
            'operation' => $operation, 'request_hash' => $hash, 'result_booking_id' => $resultBookingId, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public static function lockedConflict(Organization $organization, string $publicId): SchedulingConflict
    {
        return SchedulingConflict::query()->where('organization_id', $organization->id)->where('public_id', $publicId)->lockForUpdate()->firstOrFail();
    }

    public static function activeProposal(SchedulingConflict $conflict): ?ConflictProposal
    {
        return ConflictProposal::query()->where('organization_id', $conflict->organization_id)->where('booking_id', $conflict->booking_id)->where('status', ConflictProposal::ACTIVE)->lockForUpdate()->first();
    }

    /** Ends an active proposal (releasing only its temporary claim) with a durable outcome. */
    public static function endProposal(ConflictProposal $proposal, string $status, CarbonImmutable $at): void
    {
        $proposal->forceFill(['status' => $status, 'responded_at' => $at, 'revision' => $proposal->revision + 1])->save();
    }

    /**
     * Moves a conflict to a new status, bumps its revision and appends the history event.
     *
     * @param  array<string, mixed>  $details
     */
    public static function move(SchedulingConflict $conflict, string $to, string $event, ?User $actor, string $actorType, ?ConflictProposal $proposal = null, array $details = [], ?string $resolution = null, ?CarbonImmutable $at = null): void
    {
        $at ??= CarbonImmutable::now();
        $from = $conflict->status;
        $attributes = ['status' => $to, 'revision' => $conflict->revision + 1];
        if ($to === SchedulingConflict::RESOLVED) {
            $attributes += ['resolution' => $resolution, 'resolved_at' => $at];
        } elseif ($from === SchedulingConflict::AWAITING_CUSTOMER && $to === SchedulingConflict::OPEN) {
            $attributes += ['reopened_at' => $at];
        }
        $conflict->forceFill($attributes)->save();
        ConflictRecorder::event($conflict, $event, $from, $to, $actor, $actorType, $proposal, $details);
    }

    /**
     * A booking that ended (cancelled, or otherwise no longer live) can no longer be
     * in conflict: its unresolved conflict closes and any active proposal is withdrawn.
     */
    public static function closeForBooking(Organization $organization, Booking $booking, ?User $actor, string $actorType): void
    {
        $conflict = SchedulingConflict::query()->where('organization_id', $organization->id)->where('booking_id', $booking->id)->where('status', '!=', SchedulingConflict::RESOLVED)->lockForUpdate()->first();
        if ($conflict === null) {
            return;
        }
        $now = CarbonImmutable::now();
        $before = $conflict->status;
        $proposal = self::activeProposal($conflict);
        if ($proposal !== null) {
            self::endProposal($proposal, ConflictProposal::WITHDRAWN, $now);
        }
        self::move($conflict, SchedulingConflict::RESOLVED, 'booking_closed', $actor, $actorType, $proposal, [], SchedulingConflict::BOOKING_CLOSED, $now);
        (new AuditTrail($organization, $actor))->record('scheduling_conflict.booking_closed', 'scheduling_conflict', $conflict->id, ['status' => $before], ['status' => SchedulingConflict::RESOLVED]);
    }

    public static function nudgeCustomer(Booking $booking): void
    {
        BookingLifecycleChanged::for($booking);
    }
}
