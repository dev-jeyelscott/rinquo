<?php

namespace App\Modules\Platform\Http\Requests;

final class InviteAdminRequest extends SensitiveActionRequest
{
    protected function actionRules(): array
    {
        return ['email' => ['required', 'email:rfc', 'max:254']];
    }
}
