<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Inertia\Response;

/** Services tab: vehicle types, services with variants/windows/consumption, add-ons. */
class CatalogController extends Controller
{
    public function show(Organization $organization, ReadinessEvaluator $readiness): Response
    {
        /** @var array<int, array{available: bool, reasons: list<string>}> $availability */
        $availability = collect($readiness->evaluate($organization)->variants)
            ->mapWithKeys(fn (array $variant): array => [$variant['variant_id'] => ['available' => $variant['available'], 'reasons' => $variant['reasons']]])
            ->all();

        $vehicleTypes = VehicleType::query()->where('organization_id', $organization->id)->orderBy('name')->get();
        $typeNames = $vehicleTypes->pluck('name', 'id')->all();
        $services = Service::query()->where('organization_id', $organization->id)
            ->with(['windows', 'variants.consumptions'])->orderBy('name')->get();
        $addOns = AddOn::query()->where('organization_id', $organization->id)->with(['services:id', 'vehicleTypes:id'])->orderBy('name')->get();
        $resourceTypes = ResourceType::query()->where('organization_id', $organization->id)->whereNull('archived_at')
            ->with(['resources' => fn ($query) => $query->where('is_active', true)->whereNull('archived_at')])->orderBy('name')->get();

        return OwnerPage::render('owner/settings/services', $organization, [
            'vehicleTypes' => $vehicleTypes->map(fn (VehicleType $type): array => [
                'id' => $type->id, 'name' => $type->name, 'isActive' => $type->is_active, 'archived' => $type->archived_at !== null,
            ])->all(),
            'services' => $services->map(fn (Service $service): array => [
                'id' => $service->id,
                'name' => $service->name,
                'description' => (string) $service->description,
                'isActive' => $service->is_active,
                'archived' => $service->archived_at !== null,
                'windows' => $service->windows->sortBy('starts_at')->sortBy('weekday')->map(fn (ServiceWindow $window): array => [
                    'weekday' => $window->weekday,
                    'startsAt' => substr($window->starts_at, 0, 5),
                    'endsAt' => substr($window->ends_at, 0, 5),
                ])->values()->all(),
                'variants' => $service->variants->map(fn (ServiceVehicleVariant $variant): array => [
                    'id' => $variant->id,
                    'vehicleTypeId' => $variant->vehicle_type_id,
                    'vehicleTypeName' => $typeNames[$variant->vehicle_type_id] ?? null,
                    'priceCentavos' => $variant->price_centavos,
                    'durationMinutes' => $variant->duration_minutes,
                    'bufferMinutes' => $variant->buffer_minutes,
                    'isActive' => $variant->is_active,
                    'archived' => $variant->archived_at !== null,
                    'consumption' => $variant->consumptions->map(fn (CapacityConsumption $rule): array => [
                        'resourceTypeId' => $rule->resource_type_id, 'units' => $rule->units,
                    ])->values()->all(),
                    'available' => $availability[$variant->id]['available'] ?? false,
                    'reasons' => $availability[$variant->id]['reasons'] ?? [],
                ])->values()->all(),
            ])->all(),
            'addOns' => $addOns->map(fn (AddOn $addOn): array => [
                'id' => $addOn->id,
                'name' => $addOn->name,
                'priceCentavos' => $addOn->price_centavos,
                'durationMinutes' => $addOn->duration_minutes,
                'isActive' => $addOn->is_active,
                'archived' => $addOn->archived_at !== null,
                'serviceIds' => $addOn->services->pluck('id')->all(),
                'vehicleTypeIds' => $addOn->vehicleTypes->pluck('id')->all(),
            ])->all(),
            'resourceTypes' => $resourceTypes->map(fn (ResourceType $type): array => [
                'id' => $type->id,
                'name' => $type->name,
                'largestCapacity' => (int) $type->resources->max('capacity'),
            ])->all(),
        ]);
    }
}
