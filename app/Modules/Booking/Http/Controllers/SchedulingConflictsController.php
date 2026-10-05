<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\ProposeReschedule;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Booking\Support\ConflictBoard;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Scheduling-conflict dashboard and resolution for any active member (Owner or
 * Staff; the route's can:operate policy enforces it, and non-members get a
 * 404). Conflicts and proposals are resolved only inside the route-bound
 * organization and every mutation is re-validated by the action under lock.
 */
class SchedulingConflictsController extends Controller
{
    public function index(Request $request, Organization $organization, ConflictBoard $board): Response
    {
        $selected = $request->validate(['conflict' => ['nullable', 'uuid']])['conflict'] ?? null;
        $base = route('owner.scheduling-conflicts.index', $organization, absolute: false);

        return OwnerPage::render('owner/scheduling-conflicts', $organization, $board->build($organization, CarbonImmutable::now(), $selected) + [
            'urls' => ['conflicts' => $base, 'operations' => route('owner.operations.index', $organization, absolute: false)],
        ]);
    }

    public function propose(Request $request, Organization $organization, string $conflict, ProposeReschedule $propose): RedirectResponse
    {
        $data = $this->common($request) + $request->validate(['start_at' => ['required', 'date']]);
        $proposal = $propose->send($organization, $request->user(), $conflict, $data['revision'], $data['idempotency_key'], $data['start_at']);

        $format = 'D, M j \a\t g:i A';
        $name = $this->find($organization, $conflict)->booking->contact_name;

        return back()->with('status', 'Proposal sent to '.$name.' for '.$proposal->proposed_start_at->setTimezone('Asia/Manila')->format($format)
            .'. They have until '.$proposal->expires_at->setTimezone('Asia/Manila')->format($format).' to answer; the original time stays reserved.');
    }

    public function withdraw(Request $request, Organization $organization, string $conflict, ProposeReschedule $propose): RedirectResponse
    {
        $data = $this->common($request);
        $propose->withdraw($organization, $request->user(), $conflict, $data['revision'], $data['idempotency_key']);

        return back()->with('status', 'Proposal withdrawn. The booking is back in the conflict queue and its original time is still reserved.');
    }

    /** @return array{revision: int, idempotency_key: string} */
    private function common(Request $request): array
    {
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'idempotency_key' => ['required', 'uuid']]);

        return ['revision' => (int) $data['revision'], 'idempotency_key' => $data['idempotency_key']];
    }

    private function find(Organization $organization, string $publicId): SchedulingConflict
    {
        return SchedulingConflict::query()->where('organization_id', $organization->id)->where('public_id', $publicId)->with('booking')->firstOrFail();
    }
}
