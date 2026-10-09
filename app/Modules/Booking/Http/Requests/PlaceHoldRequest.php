<?php

namespace App\Modules\Booking\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

class PlaceHoldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public endpoint: the shop gate, throttle and capacity claim are server-side.
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'idempotency_key' => ['required', 'uuid'],
            'vehicle_type_id' => ['required', 'integer', 'min:1'],
            'service_id' => ['required', 'integer', 'min:1'],
            'add_on_ids' => ['present', 'array', 'max:20'],
            'add_on_ids.*' => ['integer', 'min:1', 'distinct'],
            'start_at' => ['required', 'string', 'max:40', 'date'],
            'vehicle_make_model' => ['required', 'string', 'max:120', 'regex:/\S/'],
            // Only an authenticated customer may name a platform vehicle. The
            // controller still resolves it through that customer's user id.
            'customer_vehicle_id' => $this->user() === null ? ['prohibited'] : ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'vehicle_make_model.required' => 'Enter your vehicle make and model.',
            'vehicle_make_model.regex' => 'Enter your vehicle make and model.',
        ];
    }

    public function vehicleMakeModel(): string
    {
        return trim((string) $this->validated('vehicle_make_model'));
    }

    /** @return list<int> */
    public function addOnIds(): array
    {
        return array_values(array_map('intval', (array) $this->validated('add_on_ids')));
    }

    public function startAt(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->validated('start_at'))->utc();
    }
}
