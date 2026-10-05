<?php

namespace App\Modules\Tenancy\Http\Requests;

use App\Modules\Tenancy\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OnboardingRequest extends FormRequest
{
    /** Slugs that would collide with application paths or look official. */
    private const RESERVED = ['admin', 'api', 'app', 'owner', 'shops', 'staff', 'support', 'www', 'rinquo', 'login', 'up', 'ready', 'horizon'];

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['slug' => strtolower(trim((string) $this->input('slug')))]);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'required', 'string', 'min:3', 'max:63',
                'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                Rule::notIn(self::RESERVED),
                Rule::unique(Organization::class, 'slug'),
            ],
            'branch_name' => ['required', 'string', 'max:120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'slug.regex' => 'Use lowercase letters, numbers and single hyphens only.',
            'slug.unique' => 'This shop address is already taken.',
            'slug.not_in' => 'This shop address is reserved.',
        ];
    }
}
