<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

class ConsumptionRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'rules' => ['present', 'array', 'max:20'],
            'rules.*.resource_type_id' => ['required', 'integer', 'distinct', $this->ownedActive('resource_types')],
            'rules.*.units' => ['required', 'integer', 'min:1', 'max:10000'],
        ];
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // A rule above every active resource's capacity could never be served.
            foreach ($this->input('rules', []) as $index => $rule) {
                $largest = (int) DB::table('physical_resources')
                    ->where('organization_id', $this->organization()->id)
                    ->where('resource_type_id', (int) $rule['resource_type_id'])
                    ->where('is_active', true)
                    ->whereNull('archived_at')
                    ->max('capacity');

                if ((int) $rule['units'] > $largest) {
                    $validator->errors()->add("rules.{$index}.units", $largest === 0
                        ? 'Add an active resource of this type before using it.'
                        : "No single active resource of this type can hold {$rule['units']} units (largest: {$largest}).");
                }
            }
        }];
    }

    /** @return list<array{resource_type_id: int, units: int}> */
    public function consumption(): array
    {
        return array_values(array_map(fn (array $r): array => ['resource_type_id' => (int) $r['resource_type_id'], 'units' => (int) $r['units']], $this->validated('rules')));
    }
}
