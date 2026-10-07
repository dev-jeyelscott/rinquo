<?php

namespace App\Modules\Platform\Http\Requests;

use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Auth\StepUp;
use App\Modules\Platform\Models\PlatformAdmin;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

/**
 * Base for every sensitive platform action. The acting admin must re-enter their password
 * and a fresh authenticator code in the same request; the assertion is used once and never stored.
 */
abstract class SensitiveActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Auth::guard(PlatformSession::GUARD)->check();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...$this->actionRules(),
            'current_password' => ['required', 'string', 'max:255'],
            'otp_code' => ['required', 'digits:6'],
        ];
    }

    /** @return array<string, mixed> */
    protected function actionRules(): array
    {
        return [];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $verified = app(StepUp::class)->verify($this->admin(), (string) $this->input('current_password'), (string) $this->input('otp_code'));
            if (! $verified) {
                $validator->errors()->add('otp_code', 'Your password or authenticator code was not accepted.');
            }
        }];
    }

    public function admin(): PlatformAdmin
    {
        /** @var PlatformAdmin $admin */
        $admin = Auth::guard(PlatformSession::GUARD)->user();

        return $admin;
    }
}
