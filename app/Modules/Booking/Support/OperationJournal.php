<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingOperationEvent;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Idempotency, append-only operation history and audit for staff operations.
 * Every method runs inside the caller's transaction, under the organization lock.
 */
final class OperationJournal
{
    /** @param  array<string, mixed>  $payload */
    public static function hash(User $actor, ?int $bookingId, string $operation, ?int $revision, array $payload): string
    {
        return hash('sha256', json_encode(['actor' => $actor->id, 'booking' => $bookingId, 'operation' => $operation, 'revision' => $revision, 'payload' => $payload], JSON_THROW_ON_ERROR));
    }

    /** The booking a previous identical request produced, or null; a reused key with a changed request is rejected. */
    public static function replay(Organization $organization, User $actor, string $key, string $operation, string $hash): ?Booking
    {
        $row = DB::table('booking_operation_requests')->where('organization_id', $organization->id)->where('idempotency_key', $key)->first();
        if ($row === null) {
            return null;
        }
        if ($row->actor_user_id !== $actor->id || $row->operation !== $operation || ! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different action.']);
        }

        return Booking::query()->where('organization_id', $organization->id)->whereKey($row->booking_id)->firstOrFail();
    }

    public static function remember(Organization $organization, User $actor, Booking $booking, string $key, string $operation, string $hash): void
    {
        DB::table('booking_operation_requests')->insert([
            'organization_id' => $organization->id, 'booking_id' => $booking->id, 'actor_user_id' => $actor->id,
            'idempotency_key' => $key, 'operation' => $operation, 'request_hash' => $hash, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** @param  array<string, scalar|array<array-key, mixed>|null>  $details */
    public static function record(Organization $organization, User $actor, Booking $booking, string $operation, ?string $fromState, ?int $fromResource, ?int $toResource, ?string $reason, array $details = []): void
    {
        BookingOperationEvent::query()->create([
            'organization_id' => $organization->id, 'booking_id' => $booking->id, 'actor_user_id' => $actor->id,
            'operation' => $operation, 'from_state' => $fromState, 'to_state' => $booking->operational_state,
            'from_resource_id' => $fromResource, 'to_resource_id' => $toResource, 'reason' => $reason,
            'operation_revision' => $booking->operation_revision, 'details' => $details === [] ? null : $details,
        ]);

        (new AuditTrail($organization, $actor))->record(
            'booking.'.$operation,
            'booking',
            $booking->id,
            ['state' => $fromState, 'resource_id' => $fromResource],
            ['state' => $booking->operational_state, 'resource_id' => $toResource ?? $fromResource, 'operation_revision' => $booking->operation_revision, 'reason' => $reason] + $details,
        );
    }
}
