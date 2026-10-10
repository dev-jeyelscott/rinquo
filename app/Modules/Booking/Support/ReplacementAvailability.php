<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Availability\DayAvailability;
use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * The customer-safe read of replacement start times for an owned booking.
 *
 * It judges the booked service terms (the source snapshot's durations, add-ons
 * and buffer) against current hours, notice, horizon and physical-resource
 * feasibility, exactly as the reschedule write does, and returns dates, start
 * times and a boolean only. A time shown here is never a reservation: the
 * reschedule transaction revalidates it under the organization lock.
 */
final class ReplacementAvailability
{
    public function __construct(private readonly ManageBooking $lifecycle, private readonly AvailabilitySearch $search) {}

    /** Whether the booked service terms can still be offered (an archived service or add-on cannot). */
    public function resolvable(Organization $organization, Booking $source): bool
    {
        try {
            $this->lifecycle->replacementTerms($organization, $source);
        } catch (ValidationException) {
            return false;
        }

        return true;
    }

    /** @return list<array{date: string, closed: bool}> */
    public function dates(Organization $organization, Booking $source, CarbonImmutable $now): array
    {
        $policy = $organization->bookingPolicy()->firstOrFail();
        $today = BranchCalendar::localDate($now);
        $last = $today->addDays($policy->horizon_days);
        $calendar = BranchCalendar::load($organization->id, $source->service_id, $today, $last);
        $dates = [];
        for ($date = $today; $date <= $last; $date = $date->addDay()) {
            $dates[] = ['date' => $date->toDateString(), 'closed' => $calendar->isClosed($date)];
        }

        return $dates;
    }

    public function day(Organization $organization, Booking $source, CarbonImmutable $localDate, CarbonImmutable $now): DayAvailability
    {
        [$variant, $addOns] = $this->lifecycle->replacementTerms($organization, $source);

        return $this->search->forDate($organization, $organization->bookingPolicy()->firstOrFail(), $variant, $addOns, $localDate, $now);
    }

    /** @return array{startAt: string}|null */
    public function next(Organization $organization, Booking $source, CarbonImmutable $now): ?array
    {
        [$variant, $addOns] = $this->lifecycle->replacementTerms($organization, $source);
        $start = $this->search->nextAvailable($organization, $organization->bookingPolicy()->firstOrFail(), $variant, $addOns, $now);

        return $start === null ? null : ['startAt' => $start->utc()->toIso8601String()];
    }

    /** The first local date inside the booking window, for validation. */
    public function horizonEnd(Organization $organization, CarbonImmutable $now): CarbonImmutable
    {
        return BranchCalendar::localDate($now)->addDays($organization->bookingPolicy()->firstOrFail()->horizon_days);
    }
}
