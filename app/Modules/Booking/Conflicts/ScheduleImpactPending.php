<?php

namespace App\Modules\Booking\Conflicts;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Thrown inside the change transaction (so it rolls back, writing nothing) when
 * a scheduling change disrupts future bookings and has not been confirmed for
 * exactly this outcome. It carries the server-computed impact for the Owner to
 * review; a browser gets it as a one-request flash on the page it came from, an
 * API client as a 409.
 */
final class ScheduleImpactPending extends Exception
{
    /** @param  array<string, mixed>  $impact */
    public function __construct(public readonly array $impact, public readonly bool $stale = false)
    {
        parent::__construct('This change affects future bookings and needs confirmation.');
    }

    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $this->getMessage(), 'impact' => $this->impact + ['stale' => $this->stale]], 409);
        }

        return back()->with('scheduling_impact', $this->impact + ['stale' => $this->stale]);
    }
}
