<?php

namespace App\Modules\Booking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A staff-entered booking or walk-in. Authorization is the route's operate
 * policy; every id is re-resolved inside the route organization by the action.
 */
class StaffBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'idempotency_key' => ['required', 'uuid'],
            'mode' => ['required', Rule::in(['walk_in', 'scheduled'])],
            'start_at' => ['required_if:mode,scheduled', 'nullable', 'date'],
            'policy_exception_reason' => ['nullable', 'string', 'max:500'],
            'vehicle_type_id' => ['required', 'integer'],
            'service_id' => ['required', 'integer'],
            'add_on_ids' => ['present', 'array', 'max:20'],
            'add_on_ids.*' => ['integer', 'distinct'],
            'contact_name' => ['required', 'string', 'max:120'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'contact_email' => ['nullable', 'email:rfc', 'max:254'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array{vehicle_type_id: int, service_id: int, add_on_ids: list<int>, contact_name: string, contact_phone: ?string, contact_email: ?string, vehicle_plate: ?string, customer_notes: ?string, mode: string, start_at: ?string, policy_exception_reason: ?string} */
    public function booking(): array
    {
        $data = $this->validated();

        return [
            'vehicle_type_id' => (int) $data['vehicle_type_id'],
            'service_id' => (int) $data['service_id'],
            'add_on_ids' => array_values(array_map('intval', $data['add_on_ids'])),
            'contact_name' => trim($data['contact_name']),
            'contact_phone' => $data['contact_phone'] ?? null,
            'contact_email' => $data['contact_email'] ?? null,
            'vehicle_plate' => $data['vehicle_plate'] ?? null,
            'customer_notes' => $data['customer_notes'] ?? null,
            'mode' => $data['mode'],
            'start_at' => $data['mode'] === 'scheduled' ? (string) $data['start_at'] : null,
            'policy_exception_reason' => $data['policy_exception_reason'] ?? null,
        ];
    }
}
