<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\VehicleType;

/** Vehicle types and resource types: a unique name and an active flag. */
class NamedRecordRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $table = $this->routeIs('owner.settings.resource-types.*') ? (new ResourceType)->getTable() : (new VehicleType)->getTable();
        $current = $this->routeModel('resourceType') ?? $this->routeModel('vehicleType');

        return [
            'name' => ['required', 'string', 'max:120', $this->uniqueName($table, $current?->getKey())],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
