<?php

namespace App\Modules\Scheduling\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;

/** Replaces the resource-consumption rules of one service/vehicle variant. */
final class ReplaceCapacityConsumption
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /** @param  list<array{resource_type_id: int, units: int}>  $rules */
    public function handle(Organization $organization, User $actor, ServiceVehicleVariant $variant, array $rules): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($variant, $rules): void {
            $before = CapacityConsumption::query()->where('service_vehicle_variant_id', $variant->id)->orderBy('resource_type_id')
                ->get(['resource_type_id', 'units'])->toArray();

            CapacityConsumption::query()->where('service_vehicle_variant_id', $variant->id)->delete();
            foreach ($rules as $rule) {
                CapacityConsumption::query()->create([
                    'organization_id' => $locked->id,
                    'service_vehicle_variant_id' => $variant->id,
                ] + $rule);
            }

            $audit->record('variant.consumption_replaced', 'variant', $variant->id, ['rules' => $before], ['rules' => $rules]);
        });
    }
}
