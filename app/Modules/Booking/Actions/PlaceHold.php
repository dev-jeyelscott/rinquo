<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Atomically reserves an exact start time for a short checkout window.
 *
 * Lock order (shared by every capacity claim): the organization row FOR UPDATE
 * first, then everything else, in one transaction with no network calls. That
 * is the same lock ChangeOrganization takes, so configuration changes and
 * claims serialize per tenant. The request is idempotent per
 * (organization, idempotency key): a replay returns the same hold, and the same
 * key with a different payload is rejected.
 */
final class PlaceHold
{
    public function __construct(
        private readonly BookingIntake $intake,
        private readonly AvailabilitySearch $search,
    ) {}

    /** @param  list<int>  $addOnIds */
    public function handle(
        Organization $organization,
        string $idempotencyKey,
        int $vehicleTypeId,
        int $serviceId,
        array $addOnIds,
        CarbonImmutable $startAt,
        string $sessionToken,
    ): Hold {
        $start = $startAt->utc();
        $tokenHash = hash('sha256', $sessionToken);

        return DB::transaction(function () use ($organization, $idempotencyKey, $vehicleTypeId, $serviceId, $addOnIds, $start, $tokenHash): Hold {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();

            $existing = Hold::query()
                ->where('organization_id', $locked->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing !== null) {
                $this->assertSamePayload($existing, $tokenHash, $vehicleTypeId, $serviceId, $addOnIds, $start);

                return $existing;
            }

            $this->intake->assertAcceptingNewBookings($locked);
            $offer = $this->intake->resolveOffer($locked, $vehicleTypeId, $serviceId, $addOnIds);
            $policy = $locked->bookingPolicy()->firstOrFail();
            $now = CarbonImmutable::now();

            // One active hold per browser session in this shop: a new selection
            // releases the old one first, so the replacement is judged only
            // against other customers' claims. A rejected replacement throws and
            // rolls the release back, leaving the previous hold untouched.
            Hold::query()
                ->where('organization_id', $locked->id)
                ->where('session_token_hash', $tokenHash)
                ->where('status', Hold::ACTIVE)
                ->update(['status' => Hold::RELEASED, 'updated_at' => $now]);

            if (! $this->search->isCandidateStart($locked, $policy, $offer->variant, $offer->addOns, $start, $now)) {
                throw ValidationException::withMessages(['start_at' => 'That time is not available. Choose another time.']);
            }

            $assignment = $this->search->feasibleClaim($locked, $offer->variant, $offer->addOns, $start, $now);

            if ($assignment === null) {
                throw ValidationException::withMessages(['start_at' => 'That time was just taken. Choose another time.']);
            }

            $serviceEnd = $start->addMinutes(AvailabilitySearch::spanMinutes($offer->variant, $offer->addOns));

            return Hold::query()->create([
                'organization_id' => $locked->id,
                'public_id' => (string) Str::uuid(),
                'session_token_hash' => $tokenHash,
                'idempotency_key' => $idempotencyKey,
                'service_vehicle_variant_id' => $offer->variant->id,
                'resource_type_id' => $assignment->rule->resource_type_id,
                'physical_resource_id' => $assignment->resource->id,
                'units' => $assignment->rule->units,
                'scheduled_start_at' => $start,
                'service_end_at' => $serviceEnd,
                'occupied_end_at' => $serviceEnd->addMinutes($offer->variant->buffer_minutes),
                'add_on_ids' => $offer->addOnIds(),
                'status' => Hold::ACTIVE,
                'expires_at' => $now->addMinutes((int) config('rinquo.booking.hold_minutes')),
            ]);
        });
    }

    /** @param  list<int>  $addOnIds */
    private function assertSamePayload(Hold $hold, string $tokenHash, int $vehicleTypeId, int $serviceId, array $addOnIds, CarbonImmutable $start): void
    {
        $variantId = ServiceVehicleVariant::query()
            ->where('organization_id', $hold->organization_id)
            ->where('service_id', $serviceId)
            ->where('vehicle_type_id', $vehicleTypeId)
            ->value('id');

        $ids = array_values(array_unique(array_map('intval', $addOnIds)));
        sort($ids);

        $same = hash_equals($hold->session_token_hash, $tokenHash)
            && $variantId === $hold->service_vehicle_variant_id
            && $ids === array_map('intval', $hold->add_on_ids)
            && $hold->scheduled_start_at->equalTo($start);

        if (! $same) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request was already used for a different selection. Please try again.']);
        }
    }
}
