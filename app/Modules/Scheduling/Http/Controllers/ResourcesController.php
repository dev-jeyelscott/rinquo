<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Inertia\Response;

/** Resources tab: resource types with their physical resources and capacities. */
class ResourcesController extends Controller
{
    public function show(Organization $organization): Response
    {
        return OwnerPage::render('owner/settings/resources', $organization, [
            'resourceTypes' => ResourceType::query()->where('organization_id', $organization->id)->with('resources')->orderBy('name')->get()
                ->map(fn (ResourceType $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'isActive' => $type->is_active,
                    'archived' => $type->archived_at !== null,
                    'resources' => $type->resources->sortBy('name')->map(fn (PhysicalResource $resource): array => [
                        'id' => $resource->id,
                        'name' => $resource->name,
                        'capacity' => $resource->capacity,
                        'isActive' => $resource->is_active,
                        'archived' => $resource->archived_at !== null,
                    ])->values()->all(),
                ])->all(),
        ]);
    }
}
