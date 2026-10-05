<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

class VariantRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $rules = [
            'price_centavos' => ['required', 'integer', 'min:0', 'max:100000000'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'buffer_minutes' => ['required', 'integer', 'min:0', 'max:480'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        if ($this->isMethod('POST')) {
            $rules['vehicle_type_id'] = ['required', 'integer', $this->ownedActive('vehicle_types')];
        }

        return $rules;
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->isMethod('POST') || $validator->errors()->isNotEmpty()) {
                return;
            }

            // The unique (service, vehicle type) pair includes archived variants.
            $exists = DB::table('service_vehicle_variants')
                ->where('organization_id', $this->organization()->id)
                ->where('service_id', $this->routeModel('service')?->getKey())
                ->where('vehicle_type_id', $this->integer('vehicle_type_id'))
                ->exists();

            if ($exists) {
                $validator->errors()->add('vehicle_type_id', 'This service already has a variant for that vehicle type (it may be archived).');
            }
        }];
    }
}
