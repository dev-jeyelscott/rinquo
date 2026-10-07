<?php

namespace App\Modules\Platform\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LoginRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['email' => ['required', 'string', 'max:254'], 'password' => ['required', 'string', 'max:255']];
    }
}
