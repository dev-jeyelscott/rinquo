<?php

namespace App\Modules\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RequestLoginCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public, unauthenticated endpoint (guest middleware + throttles).
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['email' => ['required', 'string', 'email:rfc', 'max:254']];
    }
}
