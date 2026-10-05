<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\DecideBookingRequest;
use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Pending booking requests for the shop's members (Owner or Staff; the route's
 * can:operate policy enforces it). The list is bounded and paginated, and a
 * request is always resolved inside the route-bound organization.
 */
class BookingRequestsController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Organization $organization): Response
    {
        $page = Booking::query()
            ->where('organization_id', $organization->id)
            ->where('status', Booking::PENDING_APPROVAL)
            ->where('pending_expires_at', '>', CarbonImmutable::now())
            ->with('addOns')
            ->orderBy('pending_expires_at')
            ->orderBy('id')
            ->simplePaginate(self::PER_PAGE);

        return OwnerPage::render('owner/booking-requests', $organization, [
            'requests' => $page->getCollection()->map(fn (Booking $booking): array => [
                'id' => $booking->public_id,
                'customerName' => $booking->contact_name,
                'customerEmail' => $booking->contact_email,
                'customerPhone' => $booking->contact_phone,
                'vehicleName' => $booking->vehicle_type_name,
                'vehiclePlate' => $booking->vehicle_plate,
                'serviceName' => $booking->service_name,
                'addOns' => $booking->addOns->pluck('name')->all(),
                'notes' => $booking->customer_notes,
                'startAt' => $booking->scheduled_start_at->utc()->toIso8601String(),
                'pendingExpiresAt' => $booking->pending_expires_at?->utc()->toIso8601String(),
                'timezone' => $booking->branch_timezone,
                'revision' => $booking->revision,
                'cancelUrl' => route('owner.booking-requests.cancel', [$organization, $booking->public_id], absolute: false),
            ])->values()->all(),
            'pagination' => ['previousUrl' => $page->previousPageUrl(), 'nextUrl' => $page->nextPageUrl()],
        ]);
    }

    public function approve(Request $request, Organization $organization, string $booking, DecideBookingRequest $decide): RedirectResponse
    {
        return $this->decide($request, $organization, $booking, $decide, DecideBookingRequest::APPROVE);
    }

    public function decline(Request $request, Organization $organization, string $booking, DecideBookingRequest $decide): RedirectResponse
    {
        return $this->decide($request, $organization, $booking, $decide, DecideBookingRequest::DECLINE);
    }

    public function cancel(Request $request, Organization $organization, string $booking, ManageBooking $lifecycle): RedirectResponse
    {
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'idempotency_key' => ['required', 'uuid'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $record = Booking::query()->where('organization_id', $organization->id)->where('public_id', $booking)->firstOrFail();
        $lifecycle->cancelForOperator($organization, $record->id, $request->user(), (int) $data['revision'], $data['idempotency_key'], $data['reason']);

        return back()->with('status', "Cancelled {$record->contact_name}'s booking.");
    }

    private function decide(Request $request, Organization $organization, string $publicId, DecideBookingRequest $decide, string $decision): RedirectResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        $record = Booking::query()->where('organization_id', $organization->id)->where('public_id', $publicId)->firstOrFail();
        $booking = $decide->handle($organization, $record->id, $request->user(), $decision, $validated['reason'] ?? null);

        $when = $booking->scheduled_start_at->setTimezone($booking->branch_timezone)->format('D, M j \a\t g:i A');
        $verb = $decision === DecideBookingRequest::APPROVE ? 'Approved' : 'Declined';

        return back()->with('status', "{$verb} {$booking->contact_name}'s booking for {$when}.");
    }
}
