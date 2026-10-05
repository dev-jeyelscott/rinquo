<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
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
        $organization = $this->shop($request, $slug);
        $record = $this->ownBooking($request, $organization, $booking)->load('addOns');

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
            ],
            'urls' => ['shop' => route('shops.show', $slug, absolute: false)],
        ]);
    }
}
