<?php

namespace App\Modules\Tenancy\Http\Requests;

use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner-only: enforced by the route's can:manage policy middleware.
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::in(OrganizationMedia::KINDS)],
            'alt_text' => ['required', 'string', 'max:160'],
            // `image` rejects SVG; content is sniffed, not trusted by extension.
            'file' => [
                'required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120',
                'dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
            ],
        ];
    }
}
