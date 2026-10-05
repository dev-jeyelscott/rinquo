<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Http\Requests\BookingPolicyRequest;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Inertia\Response;

/** Booking policy tab: approval mode and the time rules that govern online booking. */
class BookingPolicyController extends Controller
{
    public function show(Organization $organization): Response
    {
        $policy = $organization->bookingPolicy()->firstOrFail();

        return OwnerPage::render('owner/settings/booking-policy', $organization, [
            'policy' => [
                'approvalMode' => $policy->approval_mode,
                'slotIntervalMinutes' => $policy->slot_interval_minutes,
                'minNoticeMinutes' => $policy->min_notice_minutes,
                'horizonDays' => $policy->horizon_days,
                'approvalWindowMinutes' => $policy->approval_window_minutes,
            ],
        ]);
    }

    public function update(BookingPolicyRequest $request, Organization $organization, ChangeOrganization $change): RedirectResponse
    {
        $values = $request->values();

        $change->handle($organization, $request->user(), function (Organization $locked, $audit) use ($values): void {
            $policy = $locked->bookingPolicy()->firstOrFail();
            $before = $policy->values();

            $policy->fill($values)->save();

            if ($before !== $policy->values()) {
                $audit->record('booking_policy.updated', 'booking_policy', $policy->id, $before, $policy->values());
            }
        });

        return back()->with('status', 'Booking policy saved.');
    }
}
