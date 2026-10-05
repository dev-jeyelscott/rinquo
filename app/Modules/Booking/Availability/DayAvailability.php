<?php

namespace App\Modules\Booking\Availability;

/** The customer-safe availability of one local date: times and a boolean only. */
final readonly class DayAvailability
{
    /** @param  list<array{startAt: string, available: bool}>  $times */
    public function __construct(
        public string $date,
        public bool $closed,
        public array $times,
    ) {}

    /** @return array{date: string, closed: bool, times: list<array{startAt: string, available: bool}>} */
    public function toArray(): array
    {
        return ['date' => $this->date, 'closed' => $this->closed, 'times' => $this->times];
    }
}
