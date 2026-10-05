<?php

namespace App\Modules\Booking\Support;

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Facades\DB;

/**
 * The customer-visible choice tree for the booking wizard: vehicle types that
 * have an available variant, the services on offer for each, and the add-ons
 * compatible with that service and vehicle. It carries prices and durations
 * only; never capacities, consumption units, resources or load.
 */
final class BookingCatalog
{
    public function __construct(private readonly ReadinessEvaluator $readiness) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function build(Organization $organization): array
    {
        $variants = ServiceVehicleVariant::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $this->readiness->evaluate($organization)->availableVariantIds())
            ->orderBy('price_centavos')
            ->get();

        if ($variants->isEmpty()) {
            return [];
        }

        $services = Service::query()->where('organization_id', $organization->id)->whereIn('id', $variants->pluck('service_id'))->get()->keyBy('id');
        $vehicles = VehicleType::query()->where('organization_id', $organization->id)->whereIn('id', $variants->pluck('vehicle_type_id'))->orderBy('name')->get();
        $addOns = AddOn::query()->where('organization_id', $organization->id)->where('is_active', true)->whereNull('archived_at')->orderBy('name')->get()->keyBy('id');

        $serviceAddOns = DB::table('service_add_ons')->where('organization_id', $organization->id)->get()->groupBy('service_id');
        $vehicleAddOns = DB::table('add_on_vehicle_options')->where('organization_id', $organization->id)->get()->groupBy('vehicle_type_id');

        return array_values($vehicles->map(function (VehicleType $vehicle) use ($variants, $services, $addOns, $serviceAddOns, $vehicleAddOns): array {
            $compatible = $vehicleAddOns->get($vehicle->id, collect())->pluck('add_on_id')->all();

            return [
                'id' => $vehicle->id,
                'name' => $vehicle->name,
                'services' => $variants->where('vehicle_type_id', $vehicle->id)->map(function (ServiceVehicleVariant $variant) use ($services, $addOns, $serviceAddOns, $compatible): array {
                    $service = $services[$variant->service_id];
                    $offered = $serviceAddOns->get($variant->service_id, collect())->pluck('add_on_id')->all();

                    return [
                        'id' => $service->id,
                        'name' => $service->name,
                        'description' => $service->description,
                        'priceCentavos' => $variant->price_centavos,
                        'durationMinutes' => $variant->duration_minutes,
                        'bufferMinutes' => $variant->buffer_minutes,
                        'addOns' => $addOns->only(array_values(array_intersect($offered, $compatible)))->map(fn (AddOn $addOn): array => [
                            'id' => $addOn->id,
                            'name' => $addOn->name,
                            'priceCentavos' => $addOn->price_centavos,
                            'durationMinutes' => $addOn->duration_minutes,
                        ])->values()->all(),
                    ];
                })->sortBy('name')->values()->all(),
            ];
        })->all());
    }
}
