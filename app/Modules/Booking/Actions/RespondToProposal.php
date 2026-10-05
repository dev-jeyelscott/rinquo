<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Availability\Occupancy;
use App\Modules\Booking\Availability\ResourceFeasibility;
use App\Modules\Booking\Conflicts\ConflictLedger;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The owning customer's answer to a staff proposal. Acceptance is the ONLY
 * place the proposed time becomes a confirmed booking: under the organization
 * lock it revalidates the held slot against live configuration and occupancy,
 * creates the replacement with a fresh hold lineage from the original immutable
 * snapshot, marks the original rescheduled and resolves the conflict. Decline
 * and expiry release only the proposal's claim and return the conflict to
 * Staff; the original booking is never touched. Every path is idempotent and a
 * race between accept, decline, expiry and a staff replacement has one winner.
 */
final class RespondToProposal
{
    public const ACCEPTED = 'accepted';

    public const DECLINED = 'declined';

    /** The proposal ran out or its slot is gone: state was recorded, nothing was confirmed. */
    public const UNAVAILABLE = 'unavailable';

    public function __construct(private readonly ManageBooking $lifecycle, private readonly BookingIntake $intake, private readonly Occupancy $occupancy) {}

    /** @return array{outcome: string, booking: Booking, message: ?string} */
    public function accept(Organization $organization, User $customer, int $bookingId, string $proposalId, int $revision, string $key): array
    {
        return DB::transaction(function () use ($organization, $customer, $bookingId, $proposalId, $revision, $key): array {
            [$locked, $booking, $proposal, $conflict] = $this->lock($organization, $customer, $bookingId, $proposalId);
            $hash = ConflictLedger::hash($customer, $proposal->id, 'accept', $revision);
            if (($row = ConflictLedger::replayed($locked, $customer, $key, $conflict->id, 'accept', $hash)) !== null) {
                return ['outcome' => self::ACCEPTED, 'booking' => Booking::query()->where('organization_id', $locked->id)->whereKey($row->result_booking_id)->firstOrFail(), 'message' => null];
            }
            $now = CarbonImmutable::now();
            if ($early = $this->unanswerable($locked, $booking, $proposal, $conflict, $revision, $now)) {
                return $early;
            }

            $problem = $this->revalidate($locked, $booking, $proposal, $now);
            if ($problem !== null) {
                ConflictLedger::endProposal($proposal, ConflictProposal::WITHDRAWN, $now);
                ConflictLedger::move($conflict, SchedulingConflict::OPEN, 'proposal_unavailable', $customer, 'customer', $proposal, ['reason' => $problem], null, $now);
                ConflictLedger::nudgeCustomer($booking);

                return ['outcome' => self::UNAVAILABLE, 'booking' => $booking, 'message' => 'That time is no longer available. The shop will contact you with another option; your original time is still reserved.'];
            }

            $addOnIds = array_values(BookingAddOn::query()->where('booking_id', $booking->id)->pluck('add_on_id')->map(fn ($id): int => (int) $id)->all());
            $offer = $this->intake->resolveOfferForVariant($locked, $booking->service_vehicle_variant_id, $addOnIds);
            [$variant, $addOns] = $this->lifecycle->snapshotTerms($booking, $offer->variant, $offer->addOns);
            $hold = $this->lifecycle->convertedHold($locked, $booking, $variant, $addOns, $proposal->resource_type_id, $proposal->units, $proposal->physical_resource_id, $proposal->proposed_start_at, 'proposal:'.$proposal->public_id, $now);
            $replacement = $this->lifecycle->makeReplacement($locked, $booking, $hold, $proposal->resource_type_id, $proposal->units, $proposal->physical_resource_id, $proposal->proposed_start_at, $now);
            $this->lifecycle->transition($locked, $booking, $customer, Booking::RESCHEDULED, 'reschedule', null, $replacement->id);

            $proposal->forceFill(['status' => ConflictProposal::ACCEPTED, 'responded_at' => $now, 'replacement_booking_id' => $replacement->id, 'revision' => $proposal->revision + 1])->save();
            ConflictLedger::move($conflict, SchedulingConflict::RESOLVED, 'proposal_accepted', $customer, 'customer', $proposal, ['replacement_booking_id' => $replacement->id], SchedulingConflict::CUSTOMER_ACCEPTED, $now);
            (new AuditTrail($locked, $customer))->record('scheduling_conflict.proposal_accepted', 'scheduling_conflict', $conflict->id, ['status' => SchedulingConflict::AWAITING_CUSTOMER], [
                'status' => SchedulingConflict::RESOLVED, 'proposal_id' => $proposal->id, 'booking_id' => $booking->id, 'replacement_booking_id' => $replacement->id,
            ]);
            ConflictLedger::remember($locked, $customer, $key, $conflict->id, 'accept', $hash, $replacement->id);
            BookingNotifier::queueIfAddressed($replacement->contact_email, new BookingConfirmedMail($replacement->id));

            return ['outcome' => self::ACCEPTED, 'booking' => $replacement, 'message' => null];
        });
    }

    /** @return array{outcome: string, booking: Booking, message: ?string} */
    public function decline(Organization $organization, User $customer, int $bookingId, string $proposalId, int $revision, string $key): array
    {
        return DB::transaction(function () use ($organization, $customer, $bookingId, $proposalId, $revision, $key): array {
            [$locked, $booking, $proposal, $conflict] = $this->lock($organization, $customer, $bookingId, $proposalId);
            $hash = ConflictLedger::hash($customer, $proposal->id, 'decline', $revision);
            if (ConflictLedger::replayed($locked, $customer, $key, $conflict->id, 'decline', $hash) !== null) {
                return ['outcome' => self::DECLINED, 'booking' => $booking, 'message' => null];
            }
            $now = CarbonImmutable::now();
            if ($early = $this->unanswerable($locked, $booking, $proposal, $conflict, $revision, $now)) {
                return $early;
            }

            ConflictLedger::endProposal($proposal, ConflictProposal::DECLINED, $now);
            ConflictLedger::move($conflict, SchedulingConflict::OPEN, 'proposal_declined', $customer, 'customer', $proposal, [], null, $now);
            (new AuditTrail($locked, $customer))->record('scheduling_conflict.proposal_declined', 'scheduling_conflict', $conflict->id, ['status' => SchedulingConflict::AWAITING_CUSTOMER], ['status' => SchedulingConflict::OPEN, 'proposal_id' => $proposal->id]);
            ConflictLedger::remember($locked, $customer, $key, $conflict->id, 'decline', $hash);
            ConflictLedger::nudgeCustomer($booking);

            return ['outcome' => self::DECLINED, 'booking' => $booking, 'message' => null];
        });
    }

    /** @return array{Organization, Booking, ConflictProposal, SchedulingConflict} */
    private function lock(Organization $organization, User $customer, int $bookingId, string $proposalId): array
    {
        $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
        $proposal = ConflictProposal::query()->where('organization_id', $locked->id)->where('public_id', $proposalId)->where('booking_id', $bookingId)->lockForUpdate()->firstOrFail();
        $conflict = SchedulingConflict::query()->where('organization_id', $locked->id)->whereKey($proposal->conflict_id)->lockForUpdate()->firstOrFail();
        $booking = Booking::query()->where('organization_id', $locked->id)->whereKey($bookingId)->lockForUpdate()->firstOrFail();
        // Only the owning customer may answer; anyone else cannot tell the proposal exists.
        abort_if($booking->customer_user_id !== $customer->id, 404);

        return [$locked, $booking, $proposal, $conflict];
    }

    /**
     * Stale or finished proposals. An expired-but-unswept proposal is recorded as
     * expired here (the same transition the sweeper makes) so the conflict returns
     * to Staff; the customer gets a precise, recoverable message.
     *
     * @return array{outcome: string, booking: Booking, message: ?string}|null
     */
    private function unanswerable(Organization $organization, Booking $booking, ConflictProposal $proposal, SchedulingConflict $conflict, int $revision, CarbonImmutable $now): ?array
    {
        if ($proposal->status !== ConflictProposal::ACTIVE) {
            throw ValidationException::withMessages(['proposal' => $proposal->status === ConflictProposal::ACCEPTED ? 'This proposal was already accepted.' : 'This proposal is no longer open. Your original booking is unchanged.']);
        }
        if ($proposal->revision !== $revision) {
            throw ValidationException::withMessages(['proposal' => 'This proposal changed. Refresh to see the latest time.']);
        }
        if ($proposal->expires_at <= $now) {
            ConflictLedger::endProposal($proposal, ConflictProposal::EXPIRED, $now);
            ConflictLedger::move($conflict, SchedulingConflict::OPEN, 'proposal_expired', null, 'system', $proposal, [], null, $now);
            ConflictLedger::nudgeCustomer($booking);

            return ['outcome' => self::UNAVAILABLE, 'booking' => $booking, 'message' => 'This proposal expired. Your original time is still reserved and the shop will follow up.'];
        }
        if (! $booking->isLive() || ! in_array($booking->operational_state, [Booking::SCHEDULED, Booking::CHECKED_IN], true)) {
            throw ValidationException::withMessages(['proposal' => 'This booking can no longer be rescheduled.']);
        }

        return null;
    }

    /** Why the held slot can no longer be confirmed, or null when it still fits. */
    private function revalidate(Organization $organization, Booking $booking, ConflictProposal $proposal, CarbonImmutable $now): ?string
    {
        $resource = PhysicalResource::query()->where('organization_id', $organization->id)->whereKey($proposal->physical_resource_id)->first();
        $type = $resource === null ? null : ResourceType::query()->where('organization_id', $organization->id)->whereKey($resource->resource_type_id)->first();
        if ($resource === null || ! $resource->is_active || $resource->archived_at !== null || $type === null || ! $type->is_active || $type->archived_at !== null) {
            return 'resource_unavailable';
        }
        $calendar = BranchCalendar::load($organization->id, $booking->service_id, BranchCalendar::localDate($proposal->proposed_start_at), BranchCalendar::localDate($proposal->proposed_start_at));
        if (! $calendar->covers($proposal->proposed_start_at, $booking->serviceMinutes())) {
            return 'hours';
        }
        // The original is replaced by this acceptance, and the proposal is its own claim.
        $claims = $this->occupancy->claims($organization->id, [$resource->id], $proposal->proposed_start_at, $proposal->occupied_end_at, $now, excludeBookingId: $booking->id, excludeProposalId: $proposal->id)[$resource->id] ?? [];

        return ResourceFeasibility::fits($resource->capacity, $proposal->units, $proposal->proposed_start_at, $proposal->occupied_end_at, $claims) ? null : 'capacity';
    }
}
