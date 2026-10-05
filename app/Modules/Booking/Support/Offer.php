<?php

namespace App\Modules\Booking\Support;

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use Illuminate\Support\Collection;

/** A validated customer selection: one available variant plus compatible add-ons. */
final readonly class Offer
{
    /** @param  Collection<int, AddOn>  $addOns */
    public function __construct(
        public ServiceVehicleVariant $variant,
        public Service $service,
        public VehicleType $vehicleType,
        public Collection $addOns,
    ) {}

    /** @return list<int> sorted add-on ids */
    public function addOnIds(): array
    {
        $ids = $this->addOns->pluck('id')->map(fn ($id): int => (int) $id)->sort()->values()->all();

        return array_values($ids);
    }
}
