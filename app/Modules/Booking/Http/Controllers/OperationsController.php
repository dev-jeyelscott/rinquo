<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\CreateStaffBooking;
use App\Modules\Booking\Actions\ManageResourceBlocks;
use App\Modules\Booking\Actions\OperateBooking;
use App\Modules\Booking\Actions\RetryNotification;
use App\Modules\Booking\Http\Requests\StaffBookingRequest;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Support\OperationsBoard;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Staff operations dashboard and day-of actions for any active member (Owner or
 * Staff; the route's can:operate policy enforces it, and non-members get a
 * 404). Every booking, resource, block and failure is resolved inside the
 * route-bound organization, and the actions re-validate everything server-side.
 */
class OperationsController extends Controller
{
    public function index(Request $request, Organization $organization, OperationsBoard $board): Response
    {
        $now = CarbonImmutable::now();
        $date = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']])['date'] ?? null;
        $day = $date === null
            ? $now->setTimezone('Asia/Manila')->startOfDay()
            : CarbonImmutable::createFromFormat('Y-m-d', $date, 'Asia/Manila')->startOfDay();
        $base = route('owner.operations.index', $organization, absolute: false);

        return OwnerPage::render('owner/operations', $organization, $board->build($organization, $day, $now) + [
            'urls' => [
                'operations' => $base,
                'bookings' => $base.'/bookings',
                'blocks' => $base.'/blocks',
                'failures' => $base.'/failures',
                'create' => $base.'/bookings',
            ],
        ]);
    }

    public function store(StaffBookingRequest $request, Organization $organization, CreateStaffBooking $create): RedirectResponse
    {
        $booking = $create->handle($organization, $request->user(), $request->validated('idempotency_key'), $request->booking());
        $when = $booking->scheduled_start_at->setTimezone($booking->branch_timezone)->format('D, M j \a\t g:i A');
        $kind = $booking->source === Booking::SOURCE_WALK_IN ? 'walk-in' : 'booking';

        return back()->with('status', "Added {$kind} for {$booking->contact_name} on {$booking->resource_type_name} at {$when}.");
    }

    public function checkIn(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request);
        $record = $this->find($organization, $booking);
        $operate->checkIn($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key']);

        return back()->with('status', "Checked in {$record->contact_name}. Their appointment time and queue position are unchanged.");
    }

    public function assign(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request) + $request->validate(['resource_id' => ['required', 'integer']]);
        $record = $this->find($organization, $booking);
        $updated = $operate->assign($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key'], (int) $data['resource_id']);

        $name = PhysicalResource::query()->where('organization_id', $organization->id)->whereKey($updated->actual_resource_id)->value('name');

        return back()->with('status', "Assigned {$record->contact_name} to {$name}.");
    }

    public function start(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request);
        $record = $this->find($organization, $booking);
        $operate->start($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key']);

        return back()->with('status', "Started {$record->service_name} for {$record->contact_name}.");
    }

    public function complete(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request) + $request->validate(['release_buffer' => ['nullable', 'boolean'], 'reason' => ['nullable', 'string', 'max:500']]);
        $record = $this->find($organization, $booking);
        $operate->complete($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key'], (bool) ($data['release_buffer'] ?? false), $data['reason'] ?? null);

        return back()->with('status', "Completed {$record->service_name} for {$record->contact_name}.");
    }

    public function noShow(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request) + $request->validate(['confirm' => ['accepted'], 'reason' => ['required', 'string', 'max:500']]);
        $record = $this->find($organization, $booking);
        $operate->markNoShow($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key'], $data['reason']);

        return back()->with('status', "Marked {$record->contact_name} as a no-show. Their time is released.");
    }

    public function reorder(Request $request, Organization $organization, string $booking, OperateBooking $operate): RedirectResponse
    {
        $data = $this->common($request) + $request->validate(['before' => ['required', 'uuid'], 'reason' => ['required', 'string', 'max:500']]);
        $record = $this->find($organization, $booking);
        $operate->reorder($organization, $record->id, $request->user(), $data['revision'], $data['idempotency_key'], $data['before'], $data['reason']);

        return back()->with('status', "Moved {$record->contact_name} up the queue. Appointment times are unchanged.");
    }

    public function block(Request $request, Organization $organization, ManageResourceBlocks $blocks): RedirectResponse
    {
        $data = $request->validate([
            'resource_id' => ['required', 'integer'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $block = $blocks->block($organization, $request->user(), (int) $data['resource_id'], CarbonImmutable::parse($data['starts_at'])->utc(), CarbonImmutable::parse($data['ends_at'])->utc(), $data['reason']);

        $name = PhysicalResource::query()->where('organization_id', $organization->id)->whereKey($block->physical_resource_id)->value('name');

        return back()->with('status', "Blocked {$name}: {$block->reason}.");
    }

    public function releaseBlock(Request $request, Organization $organization, string $block, ManageResourceBlocks $blocks): RedirectResponse
    {
        $blocks->release($organization, $request->user(), $block);

        return back()->with('status', 'Block released. The resource can take bookings again.');
    }

    public function retryFailure(Request $request, Organization $organization, string $failure, RetryNotification $retry): RedirectResponse
    {
        $record = $retry->handle($organization, $request->user(), $failure);

        return back()->with('status', "Retrying the {$record->label()} email.");
    }

    /** @return array{revision: int, idempotency_key: string} */
    private function common(Request $request): array
    {
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'idempotency_key' => ['required', 'uuid']]);

        return ['revision' => (int) $data['revision'], 'idempotency_key' => $data['idempotency_key']];
    }

    private function find(Organization $organization, string $publicId): Booking
    {
        return Booking::query()->where('organization_id', $organization->id)->where('public_id', $publicId)->firstOrFail();
    }
}
