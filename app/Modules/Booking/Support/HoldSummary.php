<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Models\Hold;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Organization;

/**
 * Customer-facing summary of a hold's selection, from current configuration:
 * what, for how long, when and for how much. No resources, capacities or units.
 */
final class HoldSummary
{
    public function __construct(private readonly BookingIntake $intake) {}

    /**
     * @return array<string, mixed>
     */
    public function for(Organization $organization, Hold $hold): array
    {
        $offer = $this->intake->resolveOfferForVariant($organization, $hold->service_vehicle_variant_id, array_map('intval', $hold->add_on_ids));

        $addOnsPrice = (int) $offer->addOns->sum('price_centavos');

        return [
            'serviceName' => $offer->service->name,
            'vehicleName' => $offer->vehicleType->name,
            'addOns' => $offer->addOns->map(fn ($addOn): array => [
                'id' => $addOn->id,
                'name' => $addOn->name,
                'priceCentavos' => $addOn->price_centavos,
            ])->values()->all(),
            'priceCentavos' => $offer->variant->price_centavos,
            'totalCentavos' => $offer->variant->price_centavos + $addOnsPrice,
            'durationMinutes' => $offer->variant->duration_minutes + (int) $offer->addOns->sum('duration_minutes'),
            'bufferMinutes' => $offer->variant->buffer_minutes,
            'startAt' => $hold->scheduled_start_at->utc()->toIso8601String(),
            'timezone' => Branch::TIMEZONE,
            'vehicleTypeId' => $offer->vehicleType->id,
            'serviceId' => $offer->service->id,
            'addOnIds' => $offer->addOnIds(),
        ];
    }
}
