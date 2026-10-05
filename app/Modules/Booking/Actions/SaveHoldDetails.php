<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Models\Hold;

/**
 * Stores the customer's contact details on a hold that can still be confirmed
 * (active, or expired but not yet released or converted). It changes no
 * capacity claim, so it needs no organization lock; the conditional update
 * keeps a converted or released hold untouched.
 */
final class SaveHoldDetails
{
    /** @param  array{contact_name: string, contact_phone: ?string, vehicle_plate: ?string, customer_notes: ?string}  $details */
    public function handle(Hold $hold, array $details): void
    {
        $updated = Hold::query()
            ->whereKey($hold->id)
            ->whereIn('status', [Hold::ACTIVE, Hold::EXPIRED])
            ->update($details + ['updated_at' => now()]);

        abort_if($updated === 0, 404);

        $hold->forceFill($details);
    }
}
