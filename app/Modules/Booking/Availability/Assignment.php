<?php

namespace App\Modules\Booking\Availability;

use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;

/** The chosen compatible consumption rule and the one physical resource it lands on. */
final readonly class Assignment
{
    public function __construct(
        public CapacityConsumption $rule,
        public PhysicalResource $resource,
    ) {}
}
