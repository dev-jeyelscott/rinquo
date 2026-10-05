<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Scheduling\Models\PhysicalResource;

class PhysicalResourceRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $current = $this->routeModel('physicalResource');
        $currentTypeId = $current instanceof PhysicalResource ? $current->resource_type_id : $this->integer('resource_type_id');

        $rules = [
            'name' => ['required', 'string', 'max:120', $this->uniqueName('physical_resources', $current?->getKey(), 'resource_type_id', $currentTypeId)],
            'capacity' => ['required', 'integer', 'min:1', 'max:10000'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        if ($this->isMethod('POST')) {
            $rules['resource_type_id'] = ['required', 'integer', $this->ownedActive('resource_types')];
        }

        return $rules;
    }
}
