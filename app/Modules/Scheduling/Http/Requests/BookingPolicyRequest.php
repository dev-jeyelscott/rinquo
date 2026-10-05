<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Scheduling\Models\BookingPolicy;
use Illuminate\Validation\Rule;

/** Closed enums and integer ranges that match the database checks. */
class BookingPolicyRequest extends ConfigurationRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'approval_mode' => ['required', Rule::in(BookingPolicy::APPROVAL_MODES)],
            'slot_interval_minutes' => ['required', 'integer', Rule::in(BookingPolicy::SLOT_INTERVALS)],
            'min_notice_minutes' => ['required', 'integer', 'between:0,10080'],
            'horizon_days' => ['required', 'integer', 'between:1,365'],
            'approval_window_minutes' => ['required', 'integer', 'between:15,1440'],
        ];
    }

    /** @return array<string, int|string> */
    public function values(): array
    {
        /** @var array<string, int|string> $validated */
        $validated = $this->validated();

        return $validated;
    }
}
