<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Scheduling\Support\Intervals;
use Illuminate\Validation\Validator;

class WindowsRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'windows' => ['present', 'array', 'max:70'],
            'windows.*.weekday' => ['required', 'integer', 'between:1,7'],
            'windows.*.starts_at' => ['required', 'date_format:H:i'],
            'windows.*.ends_at' => ['required', 'date_format:H:i', 'after:windows.*.starts_at'],
        ];
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $intervals = array_map(fn (array $w): array => [(int) $w['weekday'], (string) $w['starts_at'], (string) $w['ends_at']], $this->input('windows', []));
            if (Intervals::overlap($intervals)) {
                $validator->errors()->add('windows', 'Service windows on the same day cannot overlap.');
            }
        }];
    }

    /** @return list<array{weekday: int, starts_at: string, ends_at: string}> */
    public function windows(): array
    {
        return array_values(array_map(fn (array $w): array => [
            'weekday' => (int) $w['weekday'], 'starts_at' => (string) $w['starts_at'], 'ends_at' => (string) $w['ends_at'],
        ], $this->validated('windows')));
    }
}
