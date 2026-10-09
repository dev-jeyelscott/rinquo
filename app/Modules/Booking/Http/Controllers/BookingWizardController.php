<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Http\ResolvesShop;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingCatalog;
use App\Modules\Booking\Support\BookingIntake;
use App\Modules\Booking\Support\BookingSession;
use App\Modules\Booking\Support\Offer;
use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Tenancy\Http\Storefront;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public booking wizard (Vehicle, Service and add-ons, Schedule). The query
 * string carries the selection, so availability and the next available start
 * are partial reloads. Customers get start times and a boolean only.
 */
class BookingWizardController extends Controller
{
    use ResolvesShop;

    public function show(
        Request $request,
        string $slug,
        Storefront $storefront,
        BookingCatalog $catalog,
        BookingIntake $intake,
        AvailabilitySearch $search,
    ): Response {
        $organization = $this->shop($request, $slug);
        $policy = $organization->bookingPolicy()->firstOrFail();
        $now = CarbonImmutable::now();
        $token = (new BookingSession($request->session()))->existingToken();
        $ownSession = $token === null ? null : hash('sha256', $token);
        $today = BranchCalendar::localDate($now);

        $query = Validator::make($request->query(), [
            'vehicle' => ['nullable', 'integer', 'min:1'],
            'service' => ['nullable', 'integer', 'min:1'],
            'addOns' => ['nullable', 'array', 'max:20'],
            'addOns.*' => ['integer', 'min:1', 'distinct'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ])->validate();

        $addOnIds = array_values(array_map('intval', $query['addOns'] ?? []));
        $date = isset($query['date']) ? CarbonImmutable::parse($query['date'], $today->timezone)->startOfDay() : null;

        if ($date !== null && ($date < $today || $date > $today->addDays($policy->horizon_days))) {
            throw ValidationException::withMessages(['date' => 'Choose a date within the booking window.']);
        }

        $offer = isset($query['vehicle'], $query['service'])
            ? $intake->resolveOffer($organization, (int) $query['vehicle'], (int) $query['service'], $addOnIds)
            : null;

        return Inertia::render('shops/book', [
            ...$storefront->shell($organization, $now),
            'catalog' => fn (): array => $catalog->build($organization),
            'dates' => fn (): array => $this->dates($organization, $today, $policy->horizon_days),
            'policy' => ['minNoticeMinutes' => $policy->min_notice_minutes, 'horizonDays' => $policy->horizon_days],
            'selection' => [
                'vehicle' => $offer?->vehicleType->id ?? (isset($query['vehicle']) ? (int) $query['vehicle'] : null),
                'service' => isset($query['service']) ? (int) $query['service'] : null,
                'addOns' => $offer === null ? [] : $offer->addOnIds(),
                'date' => $date?->toDateString(),
                // Typed earlier by this browser session (a released hold), so choosing another time keeps it.
                'makeModel' => $ownSession === null ? null : Hold::query()
                    ->where('organization_id', $organization->id)
                    ->where('session_token_hash', $ownSession)
                    ->whereNotNull('vehicle_make_model')
                    ->latest('id')
                    ->value('vehicle_make_model'),
            ],
            'availability' => fn (): ?array => $offer !== null && $date !== null
                ? $search->forDate($organization, $policy, $offer->variant, $offer->addOns, $date, $now, $ownSession)->toArray()
                : null,
            'nextAvailable' => fn (): ?array => $offer === null ? null : $this->next($search, $organization, $policy, $offer, $now, $ownSession),
            // An owned, active vehicle may prefill make/model and plate; ownership is re-checked when the hold is placed.
            'savedVehicles' => $request->user() === null ? [] : CustomerVehicle::query()
                ->where('user_id', $request->user()->id)
                ->whereNull('archived_at')
                ->orderBy('id')
                ->limit(20)
                ->get()
                ->map(fn (CustomerVehicle $vehicle): array => [
                    'id' => $vehicle->id,
                    'makeModel' => $vehicle->make_model,
                    'plate' => $vehicle->plate,
                    'label' => $vehicle->label,
                ])
                ->values()
                ->all(),
            'urls' => [
                'holds' => route('bookings.holds.store', $slug, absolute: false),
                'shop' => route('shops.show', $slug, absolute: false),
                'wizard' => route('bookings.wizard', $slug, absolute: false),
            ],
        ]);
    }

    /** @return array{startAt: string}|null */
    private function next(AvailabilitySearch $search, Organization $organization, BookingPolicy $policy, Offer $offer, CarbonImmutable $now, ?string $ownSession): ?array
    {
        $start = $search->nextAvailable($organization, $policy, $offer->variant, $offer->addOns, $now, $ownSession);

        return $start === null ? null : ['startAt' => $start->utc()->toIso8601String()];
    }

    /** @return list<array{date: string, closed: bool}> */
    private function dates(Organization $organization, CarbonImmutable $today, int $horizonDays): array
    {
        $last = $today->addDays($horizonDays);
        $calendar = BranchCalendar::load($organization->id, 0, $today, $last);
        $dates = [];

        for ($date = $today; $date <= $last; $date = $date->addDay()) {
            $dates[] = ['date' => $date->toDateString(), 'closed' => $calendar->isClosed($date)];
        }

        return $dates;
    }
}
