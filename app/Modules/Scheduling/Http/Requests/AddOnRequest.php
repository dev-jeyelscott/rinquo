<?php

namespace App\Modules\Scheduling\Http\Requests;

class AddOnRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120', $this->uniqueName('add_ons', $this->routeModel('addOn')?->getKey())],
            'price_centavos' => ['required', 'integer', 'min:0', 'max:100000000'],
            'duration_minutes' => ['required', 'integer', 'min:0', 'max:480'],
            'is_active' => ['sometimes', 'boolean'],
            'service_ids' => ['present', 'array', 'max:200'],
            'service_ids.*' => ['integer', 'distinct', $this->ownedActive('services')],
            'vehicle_type_ids' => ['present', 'array', 'max:200'],
            'vehicle_type_ids.*' => ['integer', 'distinct', $this->ownedActive('vehicle_types')],
        ];
    }
}
