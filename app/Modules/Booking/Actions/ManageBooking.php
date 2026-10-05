<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Conflicts\ConflictLedger;
use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\BookingLifecycleEvent;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Customer lifecycle mutations. Organization then booking locking prevents a
 * cancellation or replacement from racing capacity allocation. */
final class ManageBooking
{
    public function __construct(private readonly BookingIntake $intake, private readonly AvailabilitySearch $search) {}

    /** @return array{canCancel: bool, canReschedule: bool, reason: ?string, deadlineAt: ?string} */
    public static function eligibility(Booking $booking): array
    {
        if (! $booking->isLive()) {
            return ['canCancel' => false, 'canReschedule' => false, 'reason' => 'This booking can no longer be changed.', 'deadlineAt' => null];
        }
        $cutoff = $booking->scheduled_start_at->subMinutes((int) ($booking->policy_snapshot['min_notice_minutes'] ?? 0));
        if (CarbonImmutable::now()->greaterThanOrEqualTo($cutoff)) {
            return ['canCancel' => false, 'canReschedule' => false, 'reason' => 'The change deadline has passed.', 'deadlineAt' => null];
        }

        return ['canCancel' => true, 'canReschedule' => true, 'reason' => null, 'deadlineAt' => $cutoff->utc()->toIso8601String()];
    }

    public function cancel(Organization $organization, int $bookingId, User $actor, int $revision, string $key, ?string $reason): Booking
    {
        return $this->cancelAs($organization, $bookingId, $actor, $revision, $key, $reason, false);
    }

    /** Member cancellation is deliberately cancellation-only: staff cannot reschedule a customer. */
    public function cancelForOperator(Organization $organization, int $bookingId, User $actor, int $revision, string $key, string $reason): Booking
    {
        return $this->cancelAs($organization, $bookingId, $actor, $revision, $key, $reason, true);
    }

    private function cancelAs(Organization $organization, int $bookingId, User $actor, int $revision, string $key, ?string $reason, bool $operator): Booking
    {
        return DB::transaction(function () use ($organization, $bookingId, $actor, $revision, $key, $reason, $operator): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $booking = $this->lockedAuthorizedBooking($locked, $bookingId, $actor, $operator);
            $hash = $this->requestHash($actor, $booking, 'cancel', $revision, null);
            if (($replay = $this->replay($locked, $booking, $actor, 'cancel', $hash, $key)) !== null) {
                return $replay;
            }
            $this->assertEligible($booking, $revision, $operator);
            $this->transition($locked, $booking, $actor, Booking::CANCELLED, 'cancel', $reason);
            $this->storeRequest($locked, $booking, $actor, 'cancel', $hash, $key, $booking);

            return $booking;
        });
    }

    public function reschedule(Organization $organization, int $bookingId, User $actor, int $revision, string $key, string $startAt): Booking
    {
        return DB::transaction(function () use ($organization, $bookingId, $actor, $revision, $key, $startAt): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $source = $this->lockedAuthorizedBooking($locked, $bookingId, $actor);
            $start = CarbonImmutable::parse($startAt)->utc();
            $hash = $this->requestHash($actor, $source, 'reschedule', $revision, $start->toIso8601String());
            if (($replay = $this->replay($locked, $source, $actor, 'reschedule', $hash, $key)) !== null) {
                return $replay;
            }
            $this->assertEligible($source, $revision, false);
            // A staff proposal is the only reschedule path while one is pending, so two replacements can never compete.
            if (ConflictProposal::query()->where('organization_id', $locked->id)->where('booking_id', $source->id)->where('status', ConflictProposal::ACTIVE)->exists()) {
                throw ValidationException::withMessages(['booking' => 'The shop proposed a new time for this booking. Accept or decline it first.']);
            }
            $this->intake->assertAcceptingNewBookings($locked);
            $addOnIds = BookingAddOn::query()->where('booking_id', $source->id)->pluck('add_on_id')->map(fn ($id): int => (int) $id)->all();
            try {
                $offer = $this->intake->resolveOfferForVariant($locked, $source->service_vehicle_variant_id, $addOnIds);
            } catch (ValidationException) {
                throw ValidationException::withMessages(['start_at' => 'This booking can no longer be rescheduled to that time.']);
            }
            $policy = $locked->bookingPolicy()->firstOrFail();
            $now = CarbonImmutable::now();
            // The replacement keeps the booked service terms, so availability, the hold and the
            // booking all use the same snapshot span rather than today's catalogue duration.
            [$variant, $addOns] = $this->snapshotTerms($source, $offer->variant, $offer->addOns);
            if (! $this->search->isCandidateStart($locked, $policy, $variant, $addOns, $start, $now)) {
                throw ValidationException::withMessages(['start_at' => 'That time is not available.']);
            }
            $assignment = $this->search->feasibleClaim($locked, $variant, $addOns, $start, $now, null, $source->physical_resource_id);
            if ($assignment === null) {
                throw ValidationException::withMessages(['start_at' => 'That time is no longer available.']);
            }
            // A replacement must have its own hold lineage; it is immediately converted in this transaction.
            $hold = $this->convertedHold($locked, $source, $variant, $addOns, $assignment->rule->resource_type_id, $assignment->rule->units, $assignment->resource->id, $start, 'lifecycle:'.$key, $now);
            $replacement = $this->makeReplacement($locked, $source, $hold, $assignment->rule->resource_type_id, $assignment->rule->units, $assignment->resource->id, $start, $now);
            $this->transition($locked, $source, $actor, Booking::RESCHEDULED, 'reschedule', null, $replacement->id);
            $this->storeRequest($locked, $source, $actor, 'reschedule', $hash, $key, $replacement);

            return $replacement;
        });
    }

    /**
     * The converted hold that gives a replacement booking its own hold lineage
     * (a hold is the claim record every booking points at).
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public function convertedHold(Organization $organization, Booking $source, ServiceVehicleVariant $variant, Collection $addOns, int $resourceTypeId, int $units, int $resourceId, CarbonImmutable $start, string $seed, CarbonImmutable $now): Hold
    {
        return Hold::query()->create([
            'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'session_token_hash' => hash('sha256', $seed), 'idempotency_key' => (string) Str::uuid(),
            'service_vehicle_variant_id' => $variant->id, 'resource_type_id' => $resourceTypeId, 'physical_resource_id' => $resourceId, 'units' => $units,
            'scheduled_start_at' => $start, 'service_end_at' => $start->addMinutes(AvailabilitySearch::spanMinutes($variant, $addOns)), 'occupied_end_at' => AvailabilitySearch::occupiedEnd($variant, $addOns, $start), 'add_on_ids' => $addOns->pluck('id')->values()->all(),
            'contact_name' => $source->contact_name, 'contact_phone' => $source->contact_phone, 'vehicle_plate' => $source->vehicle_plate, 'customer_notes' => $source->customer_notes, 'status' => Hold::CONVERTED, 'expires_at' => $now,
        ]);
    }

    /**
     * In-memory copies of the offer carrying the source booking's snapshot durations.
     *
     * @param  Collection<int, AddOn>  $addOns
     * @return array{0: ServiceVehicleVariant, 1: Collection<int, AddOn>}
     */
    public function snapshotTerms(Booking $source, ServiceVehicleVariant $variant, Collection $addOns): array
    {
        $variant = clone $variant;
        $variant->duration_minutes = $source->variant_duration_minutes;
        $variant->buffer_minutes = $source->buffer_minutes;
        $lines = BookingAddOn::query()->where('booking_id', $source->id)->pluck('duration_minutes', 'add_on_id');
        $copies = $addOns->values()->map(function (AddOn $addOn) use ($lines): AddOn {
            $copy = clone $addOn;
            $copy->duration_minutes = (int) ($lines[$addOn->id] ?? $addOn->duration_minutes);

            return $copy;
        });

        return [$variant, $copies];
    }

    private function lockedAuthorizedBooking(Organization $organization, int $bookingId, User $actor, bool $operator = false): Booking
    {
        $booking = Booking::query()->where('organization_id', $organization->id)->whereKey($bookingId)->lockForUpdate()->firstOrFail();
        if (! $operator && $booking->customer_user_id !== $actor->id) {
            abort(404);
        }

        return $booking;
    }

    private function assertEligible(Booking $booking, int $revision, bool $operator): void
    {
        if ($booking->revision !== $revision) {
            throw ValidationException::withMessages(['revision' => 'This booking changed. Refresh and try again.']);
        }
        if (! $operator && ! self::eligibility($booking)['canCancel']) {
            throw ValidationException::withMessages(['booking' => self::eligibility($booking)['reason']]);
        }
        if ($operator && (! $booking->isLive() || ! in_array($booking->operational_state, [Booking::SCHEDULED, Booking::CHECKED_IN], true))) {
            throw ValidationException::withMessages(['booking' => 'This booking can no longer be cancelled.']);
        }

    }

    public function makeReplacement(Organization $organization, Booking $source, Hold $hold, int $resourceTypeId, int $units, int $resourceId, CarbonImmutable $start, CarbonImmutable $now): Booking
    {
        $minutes = $source->variant_duration_minutes + $source->add_ons_duration_minutes;
        // A reschedule never downgrades a secured booking: a confirmed source gets a confirmed
        // replacement. A pending request stays pending on its original deadline, never a fresh one.
        $pending = $source->status === Booking::PENDING_APPROVAL;
        $replacement = Booking::query()->create($source->only([
            'organization_id', 'customer_user_id', 'service_id', 'service_name', 'vehicle_type_id', 'vehicle_type_name', 'service_vehicle_variant_id', 'variant_price_centavos', 'variant_duration_minutes', 'buffer_minutes', 'add_ons_price_centavos', 'add_ons_duration_minutes', 'total_price_centavos', 'branch_timezone', 'approval_mode', 'policy_snapshot', 'contact_name', 'contact_email', 'contact_phone', 'vehicle_plate', 'customer_notes',
        ]) + [
            'public_id' => (string) Str::uuid(), 'hold_id' => $hold->id, 'status' => $pending ? Booking::PENDING_APPROVAL : Booking::CONFIRMED, 'resource_type_id' => $resourceTypeId, 'resource_type_name' => (string) ResourceType::query()->where('organization_id', $organization->id)->whereKey($resourceTypeId)->value('name'), 'consumption_units' => $units, 'physical_resource_id' => $resourceId,
            'scheduled_start_at' => $start, 'service_end_at' => $start->addMinutes($minutes), 'occupied_end_at' => $start->addMinutes($minutes + $source->buffer_minutes), 'confirmed_at' => $pending ? null : $now, 'pending_expires_at' => $pending ? $source->pending_expires_at->min($start) : null,
        ]);
        foreach (BookingAddOn::query()->where('booking_id', $source->id)->get() as $line) {
            BookingAddOn::query()->create($line->only(['organization_id', 'add_on_id', 'name', 'price_centavos', 'duration_minutes']) + ['booking_id' => $replacement->id]);
        }

        return $replacement;
    }

    private function requestHash(User $actor, Booking $booking, string $operation, int $revision, ?string $startAt): string
    {
        return hash('sha256', json_encode(['actor' => $actor->id, 'booking' => $booking->id, 'operation' => $operation, 'revision' => $revision, 'startAt' => $startAt], JSON_THROW_ON_ERROR));
    }

    private function replay(Organization $organization, Booking $booking, User $actor, string $operation, string $hash, string $key): ?Booking
    {
        $row = DB::table('booking_lifecycle_requests')->where('organization_id', $organization->id)->where('idempotency_key', $key)->first();
        if ($row === null) {
            return null;
        }
        if ($row->booking_id !== $booking->id || $row->actor_user_id !== $actor->id || $row->operation !== $operation || ! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different booking action.']);
        }

        return Booking::query()->where('organization_id', $organization->id)->whereKey($row->result_booking_id)->firstOrFail();
    }

    private function storeRequest(Organization $organization, Booking $source, User $actor, string $operation, string $hash, string $key, Booking $result): void
    {
        DB::table('booking_lifecycle_requests')->insert(['organization_id' => $organization->id, 'booking_id' => $source->id, 'actor_user_id' => $actor->id, 'idempotency_key' => $key, 'operation' => $operation, 'request_hash' => $hash, 'result_booking_id' => $result->id, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function transition(Organization $organization, Booking $booking, User $actor, string $status, string $operation, ?string $reason, ?int $replacementId = null): void
    {
        $before = $booking->status;
        $booking->forceFill(['status' => $status, 'revision' => $booking->revision + 1, 'cancelled_at' => $operation === 'cancel' ? now() : null, 'cancelled_by_user_id' => $operation === 'cancel' ? $actor->id : null, 'rescheduled_to_booking_id' => $replacementId])->save();
        BookingLifecycleEvent::query()->create(['organization_id' => $organization->id, 'booking_id' => $booking->id, 'actor_user_id' => $actor->id, 'operation' => $operation, 'from_status' => $before, 'to_status' => $status, 'reason' => $reason, 'revision' => $booking->revision]);
        if ($operation === 'cancel') {
            ConflictLedger::closeForBooking($organization, $booking, $actor, $actor->id === $booking->customer_user_id ? 'customer' : 'staff');
        }
        BookingLifecycleChanged::for($booking);
        (new AuditTrail($organization, $actor))->record('booking.'.$operation, 'booking', $booking->id, ['status' => $before, 'revision' => $booking->revision - 1], ['status' => $status, 'revision' => $booking->revision, 'reason' => $reason, 'replacement_booking_id' => $replacementId]);
    }
}
