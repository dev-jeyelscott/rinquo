<?php

namespace App\Modules\Platform\Http\Requests;

final class StartSupportRequest extends SensitiveActionRequest
{
    protected function actionRules(): array
    {
        return [
            'target_user_id' => ['required', 'integer'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            // A ticket or case reference; letters, digits and simple separators only.
            'reference' => ['required', 'string', 'min:3', 'max:120', 'regex:/^[A-Za-z0-9][A-Za-z0-9._\/#:-]*$/'],
        ];
    }
}
