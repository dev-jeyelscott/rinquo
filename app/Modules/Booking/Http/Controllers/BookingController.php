<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Http\ResolvesShop;
use App\Modules\Tenancy\Http\Storefront;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The durable booking result page. Only the customer who owns the booking can
 * open it, inside its shop; everyone else gets a 404.
 */
class BookingController extends Controller
{
    use ResolvesShop;

    public function show(Request $request, string $slug, string $booking, Storefront $storefront): Response
    {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking)->load('addOns');
        $actions = ManageBooking::eligibility($record);
        $restricted = $actions['canReschedule'] && $storefront->visibleOrganization($slug) === null;

        return Inertia::render('shops/bookings/show', [
            ...$storefront->shell($organization),
            'booking' => [
                'publicId' => $record->public_id,
                'status' => $record->status,
                'serviceName' => $record->service_name,
                'vehicleName' => $record->vehicle_type_name,
                'addOns' => $record->addOns->map(fn ($addOn): array => ['name' => $addOn->name, 'priceCentavos' => $addOn->price_centavos])->all(),
                'totalCentavos' => $record->total_price_centavos,
                'durationMinutes' => $record->variant_duration_minutes + $record->add_ons_duration_minutes,
                'bufferMinutes' => $record->buffer_minutes,
                'startAt' => $record->scheduled_start_at->utc()->toIso8601String(),
                'timezone' => $record->branch_timezone,
                'pendingExpiresAt' => $record->pending_expires_at?->utc()->toIso8601String(),
                'contactName' => $record->contact_name,
                'contactEmail' => $record->contact_email,
                'revision' => $record->revision,
                'actions' => [
                    ...$actions,
                    'canReschedule' => $actions['canReschedule'] && ! $restricted,
                    'rescheduleReason' => $restricted ? 'Rescheduling is unavailable while this shop is not accepting new bookings. You can still cancel.' : null,
                ],
            ],
            'urls' => [
                'shop' => route('shops.show', $slug, absolute: false),
                'cancel' => route('bookings.cancel', [$slug, $record->public_id], absolute: false),
                'reschedule' => route('bookings.reschedule', [$slug, $record->public_id], absolute: false),
            ],
        ]);
    }

    public function cancel(Request $request, string $slug, string $booking, ManageBooking $lifecycle)
    {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking);
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'idempotency_key' => ['required', 'uuid'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $lifecycle->cancel($organization, $record->id, $request->user(), (int) $data['revision'], $data['idempotency_key'], $data['reason'] ?? null);

        return to_route('bookings.show', [$slug, $record->public_id]);
    }

    public function reschedule(Request $request, string $slug, string $booking, ManageBooking $lifecycle)
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownBooking($request, $organization, $booking);
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'idempotency_key' => ['required', 'uuid'],
            'start_at' => ['required', 'date'],
        ]);

        $replacement = $lifecycle->reschedule($organization, $record->id, $request->user(), (int) $data['revision'], $data['idempotency_key'], $data['start_at']);

        return to_route('bookings.show', [$slug, $replacement->public_id]);
    }
}
