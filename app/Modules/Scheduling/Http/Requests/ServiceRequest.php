<?php

namespace App\Modules\Scheduling\Http\Requests;

class ServiceRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120', $this->uniqueName('services', $this->routeModel('service')?->getKey())],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
