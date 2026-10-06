<?php

namespace App\Modules\Booking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HoldDetailsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public endpoint: the hold is bound to this browser session.
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'contact_name' => ['required', 'string', 'min:1', 'max:120'],
            'contact_phone' => ['nullable', 'string', 'max:40', 'regex:/^[+0-9 ()\-]*$/'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            // Only an authenticated customer may name a platform vehicle. The
            // controller still resolves it through that customer's user id.
            'customer_vehicle_id' => [$this->user() === null ? 'prohibited' : 'nullable', 'integer'],
            'customer_notes' => ['nullable', 'string', 'max:500'],
            // A signed-in customer's verified email is used; others verify the one typed here.
            'email' => [$this->user() === null ? 'required' : 'prohibited', 'string', 'email:rfc', 'max:254'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'contact_name.required' => 'Enter your name.',
            'contact_phone.regex' => 'Use digits, spaces and + ( ) - only.',
            'email.prohibited' => 'You are already signed in.',
        ];
    }

    /** @return array{contact_name: string, contact_phone: ?string, vehicle_plate: ?string, customer_notes: ?string} */
    public function details(): array
    {
        $clean = fn (string $key): ?string => ($value = trim((string) $this->validated($key))) === '' ? null : $value;

        return [
            'contact_name' => trim((string) $this->validated('contact_name')),
            'contact_phone' => $clean('contact_phone'),
            'vehicle_plate' => $clean('vehicle_plate'),
            'customer_notes' => $clean('customer_notes'),
        ];
    }
}
