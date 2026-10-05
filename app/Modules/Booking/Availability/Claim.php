<?php

namespace App\Modules\Booking\Availability;

use Carbon\CarbonImmutable;

/** One live capacity claim on a physical resource over [start, end). */
final readonly class Claim
{
    public function __construct(
        public CarbonImmutable $start,
        public CarbonImmutable $end,
        public int $units,
    ) {}
}
