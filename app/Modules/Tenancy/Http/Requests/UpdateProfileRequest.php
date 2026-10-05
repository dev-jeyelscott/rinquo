<?php

namespace App\Modules\Tenancy\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner-only: enforced by the route's can:manage policy middleware.
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'tagline' => ['required', 'string', 'max:160'],
            'description' => ['required', 'string', 'max:2000'],
            'brand_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'branch_name' => ['required', 'string', 'max:120'],
            'address_line' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\-.\s]{5,40}$/'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'brand_color.regex' => 'Use a hex color such as #1E40AF.',
            'phone.regex' => 'Enter a valid phone number.',
        ];
    }
}
