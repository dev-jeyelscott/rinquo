<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Actions\RespondToProposal;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Http\ResolvesShop;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Support\CustomerBookingView;
use App\Modules\Booking\Support\ReplacementAvailability;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Http\Storefront;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The durable booking result page. Only the customer who owns the booking can
 * open it, inside its shop; everyone else gets a 404.
 */
class BookingController extends Controller
{
    use ResolvesShop;

    public function show(
        Request $request,
        string $slug,
        string $booking,
        Storefront $storefront,
        AccessResolver $access,
        CustomerBookingView $view,
        ReplacementAvailability $replacements,
    ): Response {
        $organization = $this->bookingShop($slug);
        $record = $this->ownBooking($request, $organization, $booking)->load('addOns');
        $actions = ManageBooking::eligibility($record);
        $restricted = $actions['canReschedule']
            && ($storefront->visibleOrganization($slug) === null || ! $access->for($organization)->allowsCustomerReschedule());
        // Only the active, unexpired proposal is shown; nothing about resources, capacity or the cause.
        $proposal = ConflictProposal::query()->where('organization_id', $organization->id)->where('booking_id', $record->id)
            ->where('status', ConflictProposal::ACTIVE)->where('expires_at', '>', now())->first();
        $data = $view->present($record, $actions, $restricted, $proposal);
        $now = CarbonImmutable::now();
        // A booked service or add-on that was archived since can no longer be re-offered: the page still
        // renders and cancelling stays available; only rescheduling is withdrawn, with a customer-safe reason.
        if ($data['actions']['canReschedule'] && ! $replacements->resolvable($organization, $record)) {
            $data['actions']['canReschedule'] = false;
            $data['actions']['rescheduleReason'] = 'Rescheduling is unavailable because this service has changed. You can still cancel, or contact the shop.';
        }
        // Replacement times exist only while a reschedule can really be attempted; they are partial reloads.
        $offered = $data['actions']['canReschedule'];
        $today = BranchCalendar::localDate($now);
        $query = Validator::make($request->query(), ['date' => ['nullable', 'date_format:Y-m-d']])->validate();
        $date = isset($query['date']) ? CarbonImmutable::parse($query['date'], $today->timezone)->startOfDay() : null;
        if ($offered && $date !== null && ($date < $today || $date > $replacements->horizonEnd($organization, $now))) {
            throw ValidationException::withMessages(['date' => 'Choose a date within the booking window.']);
        }
        // The next available start is searched once per request and shared by the day and "next" props.
        $next = null;
        $nextLoaded = false;
        $nextStart = function () use (&$next, &$nextLoaded, $replacements, $organization, $record, $now): ?array {
            if (! $nextLoaded) {
                try {
                    $next = $replacements->next($organization, $record, $now);
                } catch (ValidationException) {
                    $next = null;
                }
                $nextLoaded = true;
            }

            return $next;
        };

        return Inertia::render('shops/bookings/show', [
            ...$storefront->shell($organization),
            'booking' => $data,
            'replacementDates' => fn (): ?array => $offered ? $replacements->dates($organization, $record, $now) : null,
            // Without a chosen date, the day of the next available time opens first (no extra round trip).
            'replacementAvailability' => function () use ($offered, $date, $replacements, $organization, $record, $now, $nextStart): ?array {
                if (! $offered) {
                    return null;
                }
                $day = $date ?? (($start = $nextStart()) !== null
                    ? BranchCalendar::localDate(CarbonImmutable::parse($start['startAt']))
                    : null);
                if ($day === null) {
                    return null;
                }
                try {
                    return $replacements->day($organization, $record, $day, $now)->toArray();
                } catch (ValidationException) {
                    return null;
                }
            },
            'replacementNext' => fn (): ?array => $offered ? $nextStart() : null,
            'urls' => [
                'shop' => route('shops.show', $slug, absolute: false),
                'cancel' => route('bookings.cancel', [$slug, $record->public_id], absolute: false),
                'reschedule' => route('bookings.reschedule', [$slug, $record->public_id], absolute: false),
                'acceptProposal' => route('bookings.proposal.accept', [$slug, $record->public_id], absolute: false),
                'declineProposal' => route('bookings.proposal.decline', [$slug, $record->public_id], absolute: false),
                'booking' => route('bookings.show', [$slug, $record->public_id], absolute: false),
                'rescheduledFrom' => $data['rescheduledFrom'] === null ? null : route('bookings.show', [$slug, $data['rescheduledFrom']['publicId']], absolute: false),
                'rescheduledTo' => $data['rescheduledTo'] === null ? null : route('bookings.show', [$slug, $data['rescheduledTo']['publicId']], absolute: false),
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
