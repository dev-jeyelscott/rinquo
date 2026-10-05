<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\Assignment;
use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Booking\Support\Offer;
use App\Modules\Booking\Support\OperationJournal;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * A staff-entered booking: a walk-in placed in the earliest real gap today, or a
 * future appointment at a chosen time. It resolves today's catalogue terms into
 * a new immutable snapshot and uses the same calendar, grid and per-resource
 * feasibility as customers, under the organization lock.
 *
 * Staff may waive only the minimum-notice rule, and only with a reason that is
 * audited. Opening and service windows, compatibility, active resources, blocks
 * and capacity are never bypassed. The contact is plain data: no account is
 * created, linked or marked verified.
 */
final class CreateStaffBooking
{
    public function __construct(private readonly BookingIntake $intake, private readonly AvailabilitySearch $search) {}

    /**
     * @param  array{vehicle_type_id: int, service_id: int, add_on_ids: list<int>, contact_name: string, contact_phone: ?string, contact_email: ?string, vehicle_plate: ?string, customer_notes: ?string, mode: string, start_at: ?string, policy_exception_reason: ?string}  $data
     */
    public function handle(Organization $organization, User $actor, string $key, array $data): Booking
    {
        $walkIn = $data['mode'] === 'walk_in';
        $payload = $data;
        sort($payload['add_on_ids']);
        $hash = OperationJournal::hash($actor, null, 'create', null, $payload);

        return DB::transaction(function () use ($organization, $actor, $key, $data, $walkIn, $hash): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            if (($replay = OperationJournal::replay($locked, $actor, $key, 'create', $hash)) !== null) {
                return $replay;
            }

            $offer = $this->intake->resolveOffer($locked, $data['vehicle_type_id'], $data['service_id'], array_map('intval', $data['add_on_ids']));
            $policy = $locked->bookingPolicy()->firstOrFail();
            $now = CarbonImmutable::now();
            $exception = null;
            [$start, $assignment] = $walkIn
                ? $this->earliestGap($locked, $policy, $offer, $now)
                : $this->chosenTime($locked, $policy, $offer, $now, (string) $data['start_at'], $data['policy_exception_reason'], $exception);

            $booking = $this->persist($locked, $policy, $offer, $assignment, $start, $now, $data, $walkIn);
            OperationJournal::record($locked, $actor, $booking, 'create', null, null, $booking->physical_resource_id, null, array_filter([
                'source' => $booking->source,
                'policy_exception' => $exception,
            ], fn ($value): bool => $value !== null));
            OperationJournal::remember($locked, $actor, $booking, $key, 'create', $hash);
            BookingNotifier::queueIfAddressed($booking->contact_email, new BookingConfirmedMail($booking->id));

            return $booking;
        });
    }

    /**
     * The earliest grid start today (no notice rule: the customer is here) that fits a real gap.
     *
     * @return array{CarbonImmutable, Assignment}
     */
    private function earliestGap(Organization $organization, BookingPolicy $policy, Offer $offer, CarbonImmutable $now): array
    {
        $today = BranchCalendar::localDate($now);
        $calendar = BranchCalendar::load($organization->id, $offer->service->id, $today, $today);
        $span = AvailabilitySearch::spanMinutes($offer->variant, $offer->addOns);

        foreach ($calendar->starts($today, $span, $this->withoutNotice($policy), $now) as $candidate) {
            $assignment = $this->search->feasibleClaim($organization, $offer->variant, $offer->addOns, $candidate, $now);
            if ($assignment !== null) {
                return [$candidate, $assignment];
            }
        }

        throw ValidationException::withMessages(['mode' => 'There is no free gap left today for this service. Book a later time instead.']);
    }

    /**
     * @return array{CarbonImmutable, Assignment}
     */
    private function chosenTime(Organization $organization, BookingPolicy $policy, Offer $offer, CarbonImmutable $now, string $startAt, ?string $reason, ?string &$exception): array
    {
        $start = CarbonImmutable::parse($startAt)->utc();
        $reason = $reason === null || trim($reason) === '' ? null : trim($reason);

        if (! $this->search->isCandidateStart($organization, $policy, $offer->variant, $offer->addOns, $start, $now)) {
            $withinNotice = $this->search->isCandidateStart($organization, $this->withoutNotice($policy), $offer->variant, $offer->addOns, $start, $now);
            if (! $withinNotice) {
                throw ValidationException::withMessages(['start_at' => 'That time is outside the opening hours, service window or booking horizon.']);
            }
            if ($reason === null) {
                throw ValidationException::withMessages(['policy_exception_reason' => 'That time is inside the minimum notice. Give a reason to book it anyway.']);
            }
            $exception = $reason;
        }

        $assignment = $this->search->feasibleClaim($organization, $offer->variant, $offer->addOns, $start, $now);
        if ($assignment === null) {
            throw ValidationException::withMessages(['start_at' => 'No resource is free for that whole time, including its buffer.']);
        }

        return [$start, $assignment];
    }

    private function withoutNotice(BookingPolicy $policy): BookingPolicy
    {
        $relaxed = clone $policy;
        $relaxed->min_notice_minutes = 0;

        return $relaxed;
    }

    /** @param  array<string, mixed>  $data */
    private function persist(Organization $organization, BookingPolicy $policy, Offer $offer, Assignment $assignment, CarbonImmutable $start, CarbonImmutable $now, array $data, bool $walkIn): Booking
    {
        $variant = $offer->variant;
        $addOnsPrice = (int) $offer->addOns->sum('price_centavos');
        $addOnsDuration = (int) $offer->addOns->sum('duration_minutes');
        $serviceEnd = $start->addMinutes($variant->duration_minutes + $addOnsDuration);
        $email = isset($data['contact_email']) && trim((string) $data['contact_email']) !== '' ? Str::lower(trim((string) $data['contact_email'])) : null;

        // Staff bookings keep the same hold lineage as customer ones; the hold is converted at once.
        $hold = Hold::query()->create([
            'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'session_token_hash' => hash('sha256', 'staff:'.Str::uuid()), 'idempotency_key' => (string) Str::uuid(),
            'service_vehicle_variant_id' => $variant->id, 'resource_type_id' => $assignment->rule->resource_type_id, 'physical_resource_id' => $assignment->resource->id, 'units' => $assignment->rule->units,
            'scheduled_start_at' => $start, 'service_end_at' => $serviceEnd, 'occupied_end_at' => $serviceEnd->addMinutes($variant->buffer_minutes), 'add_on_ids' => $offer->addOnIds(),
            'contact_name' => $data['contact_name'], 'contact_phone' => $data['contact_phone'] ?? null, 'vehicle_plate' => $data['vehicle_plate'] ?? null, 'customer_notes' => $data['customer_notes'] ?? null,
            'status' => Hold::CONVERTED, 'expires_at' => $now,
        ]);

        $booking = Booking::query()->create([
            'organization_id' => $organization->id, 'public_id' => (string) Str::uuid(), 'hold_id' => $hold->id,
            'customer_user_id' => null, 'source' => $walkIn ? Booking::SOURCE_WALK_IN : Booking::SOURCE_STAFF,
            'status' => Booking::CONFIRMED, 'confirmed_at' => $now, 'operational_state' => Booking::SCHEDULED, 'operation_revision' => 1,
            'service_id' => $offer->service->id, 'service_name' => $offer->service->name,
            'vehicle_type_id' => $offer->vehicleType->id, 'vehicle_type_name' => $offer->vehicleType->name,
            'service_vehicle_variant_id' => $variant->id, 'variant_price_centavos' => $variant->price_centavos, 'variant_duration_minutes' => $variant->duration_minutes, 'buffer_minutes' => $variant->buffer_minutes,
            'add_ons_price_centavos' => $addOnsPrice, 'add_ons_duration_minutes' => $addOnsDuration, 'total_price_centavos' => $variant->price_centavos + $addOnsPrice,
            'resource_type_id' => $assignment->rule->resource_type_id,
            'resource_type_name' => (string) ResourceType::query()->where('organization_id', $organization->id)->whereKey($assignment->rule->resource_type_id)->value('name'),
            'consumption_units' => $assignment->rule->units,
            'scheduled_start_at' => $start, 'service_end_at' => $serviceEnd, 'occupied_end_at' => $serviceEnd->addMinutes($variant->buffer_minutes),
            'branch_timezone' => Branch::TIMEZONE, 'approval_mode' => $policy->approval_mode, 'policy_snapshot' => $policy->snapshot(),
            'contact_name' => $data['contact_name'], 'contact_email' => $email, 'contact_phone' => $data['contact_phone'] ?? null,
            'vehicle_plate' => $data['vehicle_plate'] ?? null, 'customer_notes' => $data['customer_notes'] ?? null,
            'physical_resource_id' => $assignment->resource->id,
        ]);

        foreach ($offer->addOns as $addOn) {
            BookingAddOn::query()->create(['organization_id' => $organization->id, 'booking_id' => $booking->id, 'add_on_id' => $addOn->id, 'name' => $addOn->name, 'price_centavos' => $addOn->price_centavos, 'duration_minutes' => $addOn->duration_minutes]);
        }

        return $booking->refresh();
    }
}
