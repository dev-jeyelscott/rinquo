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
            'vehicle_make_model' => ['required', 'string', 'max:120', 'regex:/\S/'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
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
            'vehicle_make_model.required' => 'Enter your vehicle make and model.',
            'vehicle_make_model.regex' => 'Enter your vehicle make and model.',
        ];
    }

    /** @return array{contact_name: string, contact_phone: ?string, vehicle_make_model: string, vehicle_plate: ?string, customer_notes: ?string} */
    public function details(): array
    {
        $clean = fn (string $key): ?string => ($value = trim((string) $this->validated($key))) === '' ? null : $value;

        return [
            'contact_name' => trim((string) $this->validated('contact_name')),
            'contact_phone' => $clean('contact_phone'),
            'vehicle_make_model' => trim((string) $this->validated('vehicle_make_model')),
            'vehicle_plate' => $clean('vehicle_plate'),
            'customer_notes' => $clean('customer_notes'),
        ];
    }
}
