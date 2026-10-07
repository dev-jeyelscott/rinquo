<?php

namespace App\Modules\Platform\Http\Requests;

final class PublishPlanTermsRequest extends SensitiveActionRequest
{
    protected function actionRules(): array
    {
        return [
            'amount_centavos' => ['required', 'integer', 'min:1', 'max:100000000'],
            'trial_days' => ['required', 'integer', 'min:1', 'max:365'],
            'grace_days' => ['required', 'integer', 'min:1', 'max:90'],
            'effective_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }
}
