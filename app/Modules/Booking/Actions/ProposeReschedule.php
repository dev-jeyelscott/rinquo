<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Conflicts\ConflictLedger;
use App\Modules\Booking\Mail\SchedulingProposalMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Staff side of resolving a scheduling conflict: send one reschedule proposal,
 * replace it, or withdraw it. A proposal is a temporary, expiring claim on a
 * compatible resource beside the still-reserved original booking; it is never a
 * confirmed booking and never changes the booking. Everything runs under the
 * organization lock (then conflict, proposal, booking) and re-validates the
 * candidate against live configuration and occupancy, which already includes
 * the original booking and any other active proposal, so a proposal can never
 * overbook a resource. The customer is told only after a proposal is durable.
 */
final class ProposeReschedule
{
    public function __construct(private readonly AvailabilitySearch $search, private readonly BookingIntake $intake, private readonly ManageBooking $lifecycle) {}

    public function send(Organization $organization, User $actor, string $conflictId, int $revision, string $key, string $startAt): ConflictProposal
    {
        return DB::transaction(function () use ($organization, $actor, $conflictId, $revision, $key, $startAt): ConflictProposal {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $conflict = ConflictLedger::lockedConflict($locked, $conflictId);
            $start = CarbonImmutable::parse($startAt)->utc();
            $hash = ConflictLedger::hash($actor, $conflict->id, 'propose', $revision, ['start' => $start->toIso8601String()]);
            if (ConflictLedger::replayed($locked, $actor, $key, $conflict->id, 'propose', $hash) !== null) {
                return ConflictProposal::query()->where('organization_id', $locked->id)->where('conflict_id', $conflict->id)->latest('id')->firstOrFail();
            }
            $this->assertActionable($conflict, $revision);

            $booking = Booking::query()->where('organization_id', $locked->id)->whereKey($conflict->booking_id)->lockForUpdate()->firstOrFail();
            $this->assertProposable($booking);
            $now = CarbonImmutable::now();

            $addOnIds = array_values(BookingAddOn::query()->where('booking_id', $booking->id)->pluck('add_on_id')->map(fn ($id): int => (int) $id)->all());
            try {
                $offer = $this->intake->resolveOfferForVariant($locked, $booking->service_vehicle_variant_id, $addOnIds);
            } catch (ValidationException) {
                throw ValidationException::withMessages(['start_at' => 'This service can no longer be offered, so no replacement time can be proposed.']);
            }
            [$variant, $addOns] = $this->lifecycle->snapshotTerms($booking, $offer->variant, $offer->addOns);
            $policy = $locked->bookingPolicy()->firstOrFail();

            if ($start->equalTo($booking->scheduled_start_at)) {
                throw ValidationException::withMessages(['start_at' => 'Choose a different time than the current appointment.']);
            }
            if (! $this->search->isCandidateStart($locked, $policy, $variant, $addOns, $start, $now)) {
                throw ValidationException::withMessages(['start_at' => 'That time is not available.']);
            }
            // The original booking and any active proposal are still in occupancy: the new slot is
            // secured against them (dual hold) before the previous proposal is released below.
            $assignment = $this->search->feasibleClaim($locked, $variant, $addOns, $start, $now);
            if ($assignment === null) {
                throw ValidationException::withMessages(['start_at' => 'That time is no longer available.']);
            }
            $deadline = $now->addMinutes((int) ($booking->policy_snapshot['approval_window_minutes'] ?? 120))->min($booking->scheduled_start_at);
            if ($deadline <= $now->addMinutes(5)) {
                throw ValidationException::withMessages(['start_at' => 'The appointment is too close to give the customer time to respond. Contact them directly.']);
            }

            $previous = ConflictLedger::activeProposal($conflict);
            if ($previous !== null) {
                if ($previous->proposed_start_at->equalTo($start)) {
                    throw ValidationException::withMessages(['start_at' => 'This time was already proposed.']);
                }
                ConflictLedger::endProposal($previous, ConflictProposal::REPLACED, $now);
            }

            $proposal = ConflictProposal::query()->create([
                'organization_id' => $locked->id, 'public_id' => (string) Str::uuid(), 'conflict_id' => $conflict->id, 'booking_id' => $booking->id,
                'physical_resource_id' => $assignment->resource->id, 'resource_type_id' => $assignment->rule->resource_type_id, 'units' => $assignment->rule->units,
                'proposed_start_at' => $start, 'proposed_service_end_at' => $start->addMinutes(AvailabilitySearch::spanMinutes($variant, $addOns)),
                'occupied_end_at' => AvailabilitySearch::occupiedEnd($variant, $addOns, $start), 'expires_at' => $deadline, 'created_by_user_id' => $actor->id, 'revision' => 1,
            ]);
            ConflictLedger::move($conflict, SchedulingConflict::AWAITING_CUSTOMER, $previous === null ? 'proposal_sent' : 'proposal_replaced', $actor, 'staff', $proposal, [
                'start' => $start->toIso8601String(), 'expires_at' => $deadline->toIso8601String(), 'replaced_proposal_id' => $previous?->id,
            ]);
            (new AuditTrail($locked, $actor))->record('scheduling_conflict.proposal_sent', 'scheduling_conflict', $conflict->id, ['status' => SchedulingConflict::OPEN], [
                'proposal_id' => $proposal->id, 'booking_id' => $booking->id, 'start' => $start->toIso8601String(), 'expires_at' => $deadline->toIso8601String(),
            ]);
            ConflictLedger::remember($locked, $actor, $key, $conflict->id, 'propose', $hash);
            ConflictLedger::nudgeCustomer($booking);
            BookingNotifier::queueIfAddressed($booking->contact_email, new SchedulingProposalMail($booking->id));

            return $proposal;
        });
    }

    public function withdraw(Organization $organization, User $actor, string $conflictId, int $revision, string $key): SchedulingConflict
    {
        return DB::transaction(function () use ($organization, $actor, $conflictId, $revision, $key): SchedulingConflict {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $conflict = ConflictLedger::lockedConflict($locked, $conflictId);
            $hash = ConflictLedger::hash($actor, $conflict->id, 'withdraw', $revision);
            if (ConflictLedger::replayed($locked, $actor, $key, $conflict->id, 'withdraw', $hash) !== null) {
                return $conflict;
            }
            $this->assertActionable($conflict, $revision);
            $proposal = ConflictLedger::activeProposal($conflict);
            if ($proposal === null) {
                throw ValidationException::withMessages(['proposal' => 'There is no active proposal to withdraw.']);
            }

            $now = CarbonImmutable::now();
            ConflictLedger::endProposal($proposal, ConflictProposal::WITHDRAWN, $now);
            ConflictLedger::move($conflict, SchedulingConflict::OPEN, 'proposal_withdrawn', $actor, 'staff', $proposal, [], null, $now);
            (new AuditTrail($locked, $actor))->record('scheduling_conflict.proposal_withdrawn', 'scheduling_conflict', $conflict->id, ['status' => SchedulingConflict::AWAITING_CUSTOMER], ['status' => SchedulingConflict::OPEN, 'proposal_id' => $proposal->id]);
            ConflictLedger::remember($locked, $actor, $key, $conflict->id, 'withdraw', $hash);
            $booking = Booking::query()->where('organization_id', $locked->id)->whereKey($conflict->booking_id)->first();
            if ($booking !== null) {
                ConflictLedger::nudgeCustomer($booking);
            }

            return $conflict;
        });
    }

    private function assertActionable(SchedulingConflict $conflict, int $revision): void
    {
        if ($conflict->revision !== $revision) {
            throw ValidationException::withMessages(['revision' => 'This conflict changed. Refresh and try again.']);
        }
        if (! $conflict->isUnresolved()) {
            throw ValidationException::withMessages(['conflict' => 'This conflict is already resolved.']);
        }
    }

    private function assertProposable(Booking $booking): void
    {
        if (! $booking->isLive() || ! in_array($booking->operational_state, [Booking::SCHEDULED, Booking::CHECKED_IN], true) || $booking->scheduled_start_at <= CarbonImmutable::now()) {
            throw ValidationException::withMessages(['conflict' => 'This booking can no longer be rescheduled.']);
        }
        if ($booking->customer_user_id === null) {
            throw ValidationException::withMessages(['conflict' => 'This customer has no account to answer a proposal. Contact them directly, then cancel or rebook.']);
        }
    }
}
