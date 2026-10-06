<?php

namespace App\Modules\Booking\Support;

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * The gate every capacity claim passes under the organization lock: the shop
 * must accept new bookings, and the selected offer (variant and add-ons) must
 * be currently bookable. Subscription restriction and Owner closure enter
 * through {@see AccessResolver}, never a local flag.
 */
final class BookingIntake
{
    public function __construct(private readonly ReadinessEvaluator $readiness, private readonly AccessResolver $access) {}

    /**
     * The shop is public (published and ready), otherwise it is a 404; and its
     * subscription and closure must allow new work (a specific validation error).
     */
    public function assertAcceptingNewBookings(Organization $organization): void
    {
        if (! $organization->isPublished() || ! $this->readiness->evaluate($organization)->isReady()) {
            throw new NotFoundHttpException;
        }

        $this->assertNewWorkAllowed($organization);
    }

    /** Entitlement and closure only: for staff-entered work, which never needs the shop to be published. */
    public function assertNewWorkAllowed(Organization $organization): void
    {
        $this->access->assertAcceptingNewBookings($organization);
    }

    /**
     * Resolves a selection by vehicle type and service. Ids that do not belong
     * to the organization, unavailable variants and incompatible add-ons are
     * validation errors, never an existence oracle for other tenants.
     *
     * @param  list<int>  $addOnIds
     */
    public function resolveOffer(Organization $organization, int $vehicleTypeId, int $serviceId, array $addOnIds): Offer
    {
        $variant = ServiceVehicleVariant::query()
            ->where('organization_id', $organization->id)
            ->where('service_id', $serviceId)
            ->where('vehicle_type_id', $vehicleTypeId)
            ->whereNull('archived_at')
            ->first();

        if ($variant === null || ! in_array($variant->id, $this->readiness->evaluate($organization)->availableVariantIds(), true)) {
            throw ValidationException::withMessages(['service_id' => 'That service is not available for this vehicle.']);
        }

        return $this->offerFor($organization, $variant, $addOnIds);
    }

    /** @param  list<int>  $addOnIds */
    public function resolveOfferForVariant(Organization $organization, int $variantId, array $addOnIds): Offer
    {
        $variant = ServiceVehicleVariant::query()
            ->where('organization_id', $organization->id)
            ->whereKey($variantId)
            ->first();

        if ($variant === null) {
            throw ValidationException::withMessages(['service_id' => 'That service is not available for this vehicle.']);
        }

        return $this->resolveOffer($organization, $variant->vehicle_type_id, $variant->service_id, $addOnIds);
    }

    /** @param  list<int>  $addOnIds */
    private function offerFor(Organization $organization, ServiceVehicleVariant $variant, array $addOnIds): Offer
    {
        $addOnIds = array_values(array_unique($addOnIds));

        $addOns = AddOn::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $addOnIds)
            ->where('is_active', true)
            ->whereNull('archived_at')
            ->whereIn('id', DB::table('service_add_ons')->where('organization_id', $organization->id)->where('service_id', $variant->service_id)->select('add_on_id'))
            ->whereIn('id', DB::table('add_on_vehicle_options')->where('organization_id', $organization->id)->where('vehicle_type_id', $variant->vehicle_type_id)->select('add_on_id'))
            ->orderBy('id')
            ->get();

        if ($addOns->count() !== count($addOnIds)) {
            throw ValidationException::withMessages(['add_on_ids' => 'One of the selected add-ons is not available for this service and vehicle.']);
        }

        return new Offer(
            $variant,
            Service::query()->where('organization_id', $organization->id)->findOrFail($variant->service_id),
            VehicleType::query()->where('organization_id', $organization->id)->findOrFail($variant->vehicle_type_id),
            $addOns,
        );
    }
}
