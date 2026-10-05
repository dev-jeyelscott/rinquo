<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Mail\BookingApprovedMail;
use App\Modules\Booking\Mail\BookingDeclinedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Approves or declines a pending request before it expires. Lock order:
 * organization row, then the booking row. Approval does not re-run
 * feasibility: the pending claim already holds the capacity and is live until
 * its expiry. Decline releases the claim. A request is decided at most once;
 * repeating the same decision is an idempotent no-op.
 */
final class DecideBookingRequest
{
    public const APPROVE = 'approve';

    public const DECLINE = 'decline';

    public function handle(Organization $organization, int $bookingId, User $actor, string $decision, ?string $reason = null): Booking
    {
        return DB::transaction(function () use ($organization, $bookingId, $actor, $decision, $reason): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $booking = Booking::query()->where('organization_id', $locked->id)->whereKey($bookingId)->lockForUpdate()->firstOrFail();

            $approve = $decision === self::APPROVE;
            $already = $booking->decided_by_user_id !== null
                && $booking->status === ($approve ? Booking::CONFIRMED : Booking::DECLINED);

            if ($already) {
                return $booking;
            }

            $now = CarbonImmutable::now();
            if (! $booking->isPending() || $booking->pending_expires_at === null || $booking->pending_expires_at <= $now) {
                throw ValidationException::withMessages(['booking' => 'This request already expired or was decided.']);
            }

            $booking->forceFill($approve
                ? ['status' => Booking::CONFIRMED, 'confirmed_at' => $now, 'decided_at' => $now, 'decided_by_user_id' => $actor->id]
                : ['status' => Booking::DECLINED, 'decided_at' => $now, 'decided_by_user_id' => $actor->id],
            )->save();

            BookingLifecycleChanged::for($booking);
            (new AuditTrail($locked, $actor))->record(
                $approve ? 'booking.approved' : 'booking.declined',
                'booking',
                $booking->id,
                ['status' => Booking::PENDING_APPROVAL],
                $approve ? ['status' => Booking::CONFIRMED] : ['status' => Booking::DECLINED, 'reason' => $reason],
            );

            BookingNotifier::queue(
                $booking->contact_email,
                $approve ? new BookingApprovedMail($booking->id) : new BookingDeclinedMail($booking->id),
            );

            return $booking;
        });
    }
}
