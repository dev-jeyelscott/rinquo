<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Actions\ConfigurationRecords;
use App\Modules\Scheduling\Actions\ReplaceCapacityConsumption;
use App\Modules\Scheduling\Actions\ReplaceServiceWindows;
use App\Modules\Scheduling\Actions\SaveAddOn;
use App\Modules\Scheduling\Http\Requests\AddOnRequest;
use App\Modules\Scheduling\Http\Requests\ConsumptionRequest;
use App\Modules\Scheduling\Http\Requests\NamedRecordRequest;
use App\Modules\Scheduling\Http\Requests\PhysicalResourceRequest;
use App\Modules\Scheduling\Http\Requests\ServiceRequest;
use App\Modules\Scheduling\Http\Requests\VariantRequest;
use App\Modules\Scheduling\Http\Requests\WindowsRequest;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Thin create/update/archive endpoints for the configuration records. Models
 * resolve through the organization's scoped route bindings (404 on another
 * tenant's id), and each write goes through an audited, locked action.
 */
class RecordController extends Controller
{
    public function __construct(private readonly ConfigurationRecords $records) {}

    public function storeVehicleType(NamedRecordRequest $request, Organization $organization): RedirectResponse
    {
        $this->records->create($organization, $request->user(), VehicleType::class, 'vehicle_type', $this->named($request));

        return back()->with('status', 'Vehicle type added.');
    }

    public function updateVehicleType(NamedRecordRequest $request, Organization $organization, VehicleType $vehicleType): RedirectResponse
    {
        $this->records->update($organization, $request->user(), $vehicleType, 'vehicle_type', $this->named($request, $vehicleType->is_active));

        return back()->with('status', 'Vehicle type saved.');
    }

    public function archiveVehicleType(Request $request, Organization $organization, VehicleType $vehicleType): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $vehicleType, 'vehicle_type');

        return back()->with('status', 'Vehicle type archived.');
    }

    public function storeService(ServiceRequest $request, Organization $organization): RedirectResponse
    {
        $this->records->create($organization, $request->user(), Service::class, 'service', $this->service($request));

        return back()->with('status', 'Service added.');
    }

    public function updateService(ServiceRequest $request, Organization $organization, Service $service): RedirectResponse
    {
        $this->records->update($organization, $request->user(), $service, 'service', $this->service($request, $service->is_active));

        return back()->with('status', 'Service saved.');
    }

    public function archiveService(Request $request, Organization $organization, Service $service): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $service, 'service');

        return back()->with('status', 'Service archived.');
    }

    public function replaceWindows(WindowsRequest $request, Organization $organization, Service $service, ReplaceServiceWindows $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $service, $request->windows());

        return back()->with('status', 'Service windows saved.');
    }

    public function storeVariant(VariantRequest $request, Organization $organization, Service $service): RedirectResponse
    {
        $this->records->create($organization, $request->user(), ServiceVehicleVariant::class, 'variant', [
            'service_id' => $service->id,
            'vehicle_type_id' => $request->integer('vehicle_type_id'),
            ...$this->variant($request),
        ]);

        return back()->with('status', 'Variant added. Add its resource consumption to make it bookable.');
    }

    public function updateVariant(VariantRequest $request, Organization $organization, Service $service, ServiceVehicleVariant $variant): RedirectResponse
    {
        $this->records->update($organization, $request->user(), $variant, 'variant', $this->variant($request, $variant->is_active));

        return back()->with('status', 'Variant saved.');
    }

    public function archiveVariant(Request $request, Organization $organization, Service $service, ServiceVehicleVariant $variant): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $variant, 'variant');

        return back()->with('status', 'Variant archived.');
    }

    public function replaceConsumption(ConsumptionRequest $request, Organization $organization, Service $service, ServiceVehicleVariant $variant, ReplaceCapacityConsumption $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $variant, $request->consumption());

        return back()->with('status', 'Resource consumption saved.');
    }

    public function storeAddOn(AddOnRequest $request, Organization $organization, SaveAddOn $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), null, $this->addOn($request), $this->ids($request, 'service_ids'), $this->ids($request, 'vehicle_type_ids'));

        return back()->with('status', 'Add-on added.');
    }

    public function updateAddOn(AddOnRequest $request, Organization $organization, AddOn $addOn, SaveAddOn $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $addOn, $this->addOn($request, $addOn->is_active), $this->ids($request, 'service_ids'), $this->ids($request, 'vehicle_type_ids'));

        return back()->with('status', 'Add-on saved.');
    }

    public function archiveAddOn(Request $request, Organization $organization, AddOn $addOn): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $addOn, 'add_on');

        return back()->with('status', 'Add-on archived.');
    }

    public function storeResourceType(NamedRecordRequest $request, Organization $organization): RedirectResponse
    {
        $this->records->create($organization, $request->user(), ResourceType::class, 'resource_type', [
            'branch_id' => $organization->branch()->firstOrFail()->id,
            ...$this->named($request),
        ]);

        return back()->with('status', 'Resource type added.');
    }

    public function updateResourceType(NamedRecordRequest $request, Organization $organization, ResourceType $resourceType): RedirectResponse
    {
        $this->records->update($organization, $request->user(), $resourceType, 'resource_type', $this->named($request, $resourceType->is_active));

        return back()->with('status', 'Resource type saved.');
    }

    public function archiveResourceType(Request $request, Organization $organization, ResourceType $resourceType): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $resourceType, 'resource_type');

        return back()->with('status', 'Resource type archived.');
    }

    public function storeResource(PhysicalResourceRequest $request, Organization $organization): RedirectResponse
    {
        $this->records->create($organization, $request->user(), PhysicalResource::class, 'physical_resource', [
            'resource_type_id' => $request->integer('resource_type_id'),
            'name' => $request->string('name')->toString(),
            'capacity' => $request->integer('capacity'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return back()->with('status', 'Resource added.');
    }

    public function updateResource(PhysicalResourceRequest $request, Organization $organization, PhysicalResource $physicalResource): RedirectResponse
    {
        $this->records->update($organization, $request->user(), $physicalResource, 'physical_resource', [
            'name' => $request->string('name')->toString(),
            'capacity' => $request->integer('capacity'),
            'is_active' => $request->boolean('is_active', $physicalResource->is_active),
        ]);

        return back()->with('status', 'Resource saved.');
    }

    public function archiveResource(Request $request, Organization $organization, PhysicalResource $physicalResource): RedirectResponse
    {
        $this->records->archive($organization, $request->user(), $physicalResource, 'physical_resource');

        return back()->with('status', 'Resource archived.');
    }

    /** @return array{name: string, is_active: bool} */
    private function named(NamedRecordRequest $request, bool $default = true): array
    {
        return ['name' => $request->string('name')->toString(), 'is_active' => $request->boolean('is_active', $default)];
    }

    /** @return array{name: string, description: string|null, is_active: bool} */
    private function service(ServiceRequest $request, bool $default = true): array
    {
        return [
            'name' => $request->string('name')->toString(),
            'description' => $request->filled('description') ? $request->string('description')->toString() : null,
            'is_active' => $request->boolean('is_active', $default),
        ];
    }

    /** @return array{price_centavos: int, duration_minutes: int, buffer_minutes: int, is_active: bool} */
    private function variant(VariantRequest $request, bool $default = true): array
    {
        return [
            'price_centavos' => $request->integer('price_centavos'),
            'duration_minutes' => $request->integer('duration_minutes'),
            'buffer_minutes' => $request->integer('buffer_minutes'),
            'is_active' => $request->boolean('is_active', $default),
        ];
    }

    /** @return array{name: string, price_centavos: int, duration_minutes: int, is_active: bool} */
    private function addOn(AddOnRequest $request, bool $default = true): array
    {
        return [
            'name' => $request->string('name')->toString(),
            'price_centavos' => $request->integer('price_centavos'),
            'duration_minutes' => $request->integer('duration_minutes'),
            'is_active' => $request->boolean('is_active', $default),
        ];
    }

    /** @return list<int> */
    private function ids(AddOnRequest $request, string $key): array
    {
        return array_values(array_map('intval', $request->validated($key)));
    }
}
