<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Mail\BookingRequestReceivedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Turns the session's hold into exactly one booking.
 *
 * Lock order: organization row FOR UPDATE, then the hold row; then the gate and
 * feasibility are re-run for the hold's exact start (excluding its own claim),
 * the booking is inserted with immutable snapshots and the hold is marked
 * converted. bookings.hold_id is unique, so a duplicate insert is impossible,
 * and a retry or double click returns the same booking. An expired hold is
 * re-acquired when the time is still free, and rejected when it is not.
 */
final class ConfirmBooking
{
    public function __construct(
        private readonly BookingIntake $intake,
        private readonly AvailabilitySearch $search,
    ) {}

    public function handle(Organization $organization, string $holdPublicId, string $sessionToken, User $customer): Booking
    {
        $tokenHash = hash('sha256', $sessionToken);

        return DB::transaction(function () use ($organization, $holdPublicId, $tokenHash, $customer): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();

            $hold = Hold::query()
                ->where('organization_id', $locked->id)
                ->where('public_id', $holdPublicId)
                ->where('session_token_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if ($hold === null || $hold->status === Hold::RELEASED) {
                abort(404);
            }

            if ($hold->status === Hold::CONVERTED) {
                return Booking::query()->where('hold_id', $hold->id)->firstOrFail();
            }

            if (! $hold->hasDetails()) {
                throw ValidationException::withMessages(['contact_name' => 'Add your contact details before confirming.']);
            }

            $this->intake->assertAcceptingNewBookings($locked);

            $now = CarbonImmutable::now();
            $stillHeld = $hold->isLive();
            $gone = ValidationException::withMessages(['start_at' => 'That time is no longer available. Choose another time.']);

            try {
                $offer = $this->intake->resolveOfferForVariant($locked, $hold->service_vehicle_variant_id, array_map('intval', $hold->add_on_ids));
            } catch (ValidationException) {
                throw $gone;
            }

            $policy = $locked->bookingPolicy()->firstOrFail();
            $start = $hold->scheduled_start_at;

            // Notice may be shorter than the hold TTL, so a live hold can outlast
            // its start: a booking must always begin in the future.
            if ($start->lessThanOrEqualTo($now)) {
                throw $gone;
            }

            // A time the customer legitimately held stays valid for minimum
            // notice; only a re-acquire is judged against the current instant.
            $reference = $stillHeld ? $hold->created_at : $now;
            if (! $this->search->isCandidateStart($locked, $policy, $offer->variant, $offer->addOns, $start, $reference)) {
                throw $gone;
            }

            $assignment = $this->search->feasibleClaim($locked, $offer->variant, $offer->addOns, $start, $now, $hold->id, $hold->physical_resource_id);

            if ($assignment === null) {
                throw $gone;
            }

            $variant = $offer->variant;
            $addOnsPrice = (int) $offer->addOns->sum('price_centavos');
            $addOnsDuration = (int) $offer->addOns->sum('duration_minutes');
            $serviceEnd = $start->addMinutes($variant->duration_minutes + $addOnsDuration);
            $pending = $policy->requiresApproval();

            $booking = Booking::query()->create([
                'organization_id' => $locked->id,
                'public_id' => (string) Str::uuid(),
                'hold_id' => $hold->id,
                'customer_user_id' => $customer->id,
                'status' => $pending ? Booking::PENDING_APPROVAL : Booking::CONFIRMED,
                'service_id' => $offer->service->id,
                'service_name' => $offer->service->name,
                'vehicle_type_id' => $offer->vehicleType->id,
                'vehicle_type_name' => $offer->vehicleType->name,
                'service_vehicle_variant_id' => $variant->id,
                'variant_price_centavos' => $variant->price_centavos,
                'variant_duration_minutes' => $variant->duration_minutes,
                'buffer_minutes' => $variant->buffer_minutes,
                'add_ons_price_centavos' => $addOnsPrice,
                'add_ons_duration_minutes' => $addOnsDuration,
                'total_price_centavos' => $variant->price_centavos + $addOnsPrice,
                'resource_type_id' => $assignment->rule->resource_type_id,
                'resource_type_name' => (string) ResourceType::query()->where('organization_id', $locked->id)->whereKey($assignment->rule->resource_type_id)->value('name'),
                'consumption_units' => $assignment->rule->units,
                'scheduled_start_at' => $start,
                'service_end_at' => $serviceEnd,
                'occupied_end_at' => $serviceEnd->addMinutes($variant->buffer_minutes),
                'branch_timezone' => Branch::TIMEZONE,
                'approval_mode' => $policy->approval_mode,
                'policy_snapshot' => $policy->snapshot(),
                'contact_name' => (string) $hold->contact_name,
                'contact_email' => $customer->email,
                'contact_phone' => $hold->contact_phone,
                'vehicle_plate' => $hold->vehicle_plate,
                'customer_notes' => $hold->customer_notes,
                'physical_resource_id' => $assignment->resource->id,
                'confirmed_at' => $pending ? null : $now,
                'pending_expires_at' => $pending ? $now->addMinutes($policy->approval_window_minutes)->min($start) : null,
            ]);

            foreach ($offer->addOns as $addOn) {
                BookingAddOn::query()->create([
                    'organization_id' => $locked->id,
                    'booking_id' => $booking->id,
                    'add_on_id' => $addOn->id,
                    'name' => $addOn->name,
                    'price_centavos' => $addOn->price_centavos,
                    'duration_minutes' => $addOn->duration_minutes,
                ]);
            }

            $hold->forceFill(['status' => Hold::CONVERTED])->save();

            BookingNotifier::queue(
                $customer->email,
                $pending ? new BookingRequestReceivedMail($booking->id) : new BookingConfirmedMail($booking->id),
            );

            return $booking;
        });
    }
}
