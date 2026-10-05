<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Scheduling\Support\Intervals;
use Illuminate\Validation\Validator;

class HoursRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'weekly' => ['present', 'array', 'max:70'],
            'weekly.*.weekday' => ['required', 'integer', 'between:1,7'],
            'weekly.*.opens_at' => ['required', 'date_format:H:i'],
            'weekly.*.closes_at' => ['required', 'date_format:H:i', 'after:weekly.*.opens_at'],
            'overrides' => ['present', 'array', 'max:366'],
            'overrides.*.local_date' => ['required', 'date_format:Y-m-d', 'distinct'],
            'overrides.*.is_closed' => ['required', 'boolean'],
            'overrides.*.opens_at' => ['nullable', 'date_format:H:i'],
            'overrides.*.closes_at' => ['nullable', 'date_format:H:i'],
        ];
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $intervals = array_map(
                fn (array $row): array => [(int) $row['weekday'], (string) $row['opens_at'], (string) $row['closes_at']],
                $this->input('weekly', []),
            );
            if (Intervals::overlap($intervals)) {
                $validator->errors()->add('weekly', 'Opening intervals on the same day cannot overlap.');
            }

            foreach ($this->input('overrides', []) as $index => $row) {
                $closed = filter_var($row['is_closed'], FILTER_VALIDATE_BOOLEAN);
                $opens = $row['opens_at'] ?? null;
                $closes = $row['closes_at'] ?? null;

                if ($closed && (filled($opens) || filled($closes))) {
                    $validator->errors()->add("overrides.{$index}.opens_at", 'A closed date cannot have opening times.');
                } elseif (! $closed && (blank($opens) || blank($closes) || $opens >= $closes)) {
                    $validator->errors()->add("overrides.{$index}.opens_at", 'An open date needs an opening time before its closing time.');
                }
            }
        }];
    }

    /** @return list<array{weekday: int, opens_at: string, closes_at: string}> */
    public function weekly(): array
    {
        return array_values(array_map(fn (array $row): array => [
            'weekday' => (int) $row['weekday'], 'opens_at' => (string) $row['opens_at'], 'closes_at' => (string) $row['closes_at'],
        ], $this->validated('weekly')));
    }

    /** @return list<array{local_date: string, is_closed: bool, opens_at: string|null, closes_at: string|null}> */
    public function overrides(): array
    {
        return array_values(array_map(function (array $row): array {
            $closed = filter_var($row['is_closed'], FILTER_VALIDATE_BOOLEAN);

            return [
                'local_date' => (string) $row['local_date'],
                'is_closed' => $closed,
                'opens_at' => $closed ? null : (string) $row['opens_at'],
                'closes_at' => $closed ? null : (string) $row['closes_at'],
            ];
        }, $this->validated('overrides')));
    }
}
