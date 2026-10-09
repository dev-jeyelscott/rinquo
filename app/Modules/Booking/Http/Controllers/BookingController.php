<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Actions\RespondToProposal;
use App\Modules\Booking\Http\ResolvesShop;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Http\Storefront;
use Illuminate\Http\RedirectResponse;
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

    public function show(Request $request, string $slug, string $booking, Storefront $storefront, AccessResolver $access): Response
    {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking)->load('addOns');
        $actions = ManageBooking::eligibility($record);
        $restricted = $actions['canReschedule']
            && ($storefront->visibleOrganization($slug) === null || ! $access->for($organization)->allowsCustomerReschedule());
        // Only the active, unexpired proposal is shown; nothing about resources, capacity or the cause.
        $proposal = ConflictProposal::query()->where('organization_id', $organization->id)->where('booking_id', $record->id)
            ->where('status', ConflictProposal::ACTIVE)->where('expires_at', '>', now())->first();

        return Inertia::render('shops/bookings/show', [
            ...$storefront->shell($organization),
            'booking' => [
                'publicId' => $record->public_id,
                'status' => $record->status,
                'serviceName' => $record->service_name,
                'vehicleName' => $record->vehicle_type_name,
                'vehicleMakeModel' => $record->vehicle_make_model,
                'addOns' => $record->addOns->map(fn ($addOn): array => ['name' => $addOn->name, 'priceCentavos' => $addOn->price_centavos])->all(),
                'totalCentavos' => $record->total_price_centavos,
                'durationMinutes' => $record->variant_duration_minutes + $record->add_ons_duration_minutes,
                'startAt' => $record->scheduled_start_at->utc()->toIso8601String(),
                'timezone' => $record->branch_timezone,
                'pendingExpiresAt' => $record->pending_expires_at?->utc()->toIso8601String(),
                'contactName' => $record->contact_name,
                'contactEmail' => $record->contact_email,
                'revision' => $record->revision,
                'actions' => [
                    ...$actions,
                    'canReschedule' => $actions['canReschedule'] && ! $restricted && $proposal === null,
                    'rescheduleReason' => $proposal !== null
                        ? 'The shop proposed a new time. Accept or decline it first.'
                        : ($restricted ? 'Rescheduling is unavailable while this shop is not accepting new bookings. You can still cancel.' : null),
                ],
                'proposal' => $proposal === null ? null : [
                    'id' => $proposal->public_id,
                    'revision' => $proposal->revision,
                    'startAt' => $proposal->proposed_start_at->utc()->toIso8601String(),
                    'expiresAt' => $proposal->expires_at->utc()->toIso8601String(),
                ],
            ],
            'urls' => [
                'shop' => route('shops.show', $slug, absolute: false),
                'cancel' => route('bookings.cancel', [$slug, $record->public_id], absolute: false),
                'reschedule' => route('bookings.reschedule', [$slug, $record->public_id], absolute: false),
                'acceptProposal' => route('bookings.proposal.accept', [$slug, $record->public_id], absolute: false),
                'declineProposal' => route('bookings.proposal.decline', [$slug, $record->public_id], absolute: false),
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
        // The organization-locked action enforces publication, readiness and entitlement; the
        // customer keeps a specific explanation instead of a generic 404 for an existing booking.
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking);
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'idempotency_key' => ['required', 'uuid'],
            'start_at' => ['required', 'date'],
        ]);

        $replacement = $lifecycle->reschedule($organization, $record->id, $request->user(), (int) $data['revision'], $data['idempotency_key'], $data['start_at']);

        return to_route('bookings.show', [$slug, $replacement->public_id]);
    }

    public function acceptProposal(Request $request, string $slug, string $booking, RespondToProposal $respond): RedirectResponse
    {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking);
        $data = $this->proposalData($request);

        $result = $respond->accept($organization, $request->user(), $record->id, $data['proposal'], (int) $data['revision'], $data['idempotency_key']);

        return $this->answered($slug, $record->public_id, $result, 'Your new time is confirmed. Your original time was released.');
    }

    public function declineProposal(Request $request, string $slug, string $booking, RespondToProposal $respond): RedirectResponse
    {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking);
        $data = $this->proposalData($request);

        $result = $respond->decline($organization, $request->user(), $record->id, $data['proposal'], (int) $data['revision'], $data['idempotency_key']);

        return $this->answered($slug, $record->public_id, $result, 'You declined the new time. Your original booking is unchanged and the shop will follow up.');
    }

    /** @return array{proposal: string, revision: int, idempotency_key: string} */
    private function proposalData(Request $request): array
    {
        return $request->validate([
            'proposal' => ['required', 'uuid'],
            'revision' => ['required', 'integer', 'min:1'],
            'idempotency_key' => ['required', 'uuid'],
        ]);
    }

    /** @param  array{outcome: string, booking: Booking, message: ?string}  $result */
    private function answered(string $slug, string $originalId, array $result, string $success): RedirectResponse
    {
        if ($result['outcome'] === RespondToProposal::UNAVAILABLE) {
            return to_route('bookings.show', [$slug, $originalId])->withErrors(['proposal' => $result['message']]);
        }

        return to_route('bookings.show', [$slug, $result['booking']->public_id])->with('status', $success);
    }
}
