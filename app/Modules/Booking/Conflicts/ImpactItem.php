<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Booking\Models\Booking;

/** One future booking that a scheduling change disrupts, and how the plan resolves it. */
final readonly class ImpactItem
{
    public const REASSIGNED = 'reassigned';

    public const CONFLICT = 'conflict';

    public function __construct(
        public Booking $booking,
        public string $outcome,
        /** resource_blocked | resource_unavailable | compatibility | capacity | hours */
        public string $cause,
        public int $fromResourceId,
        public ?int $toResourceId,
    ) {}
}
