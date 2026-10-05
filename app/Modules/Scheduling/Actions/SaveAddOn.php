<?php

namespace App\Modules\Scheduling\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Validation\ValidationException;

/**
 * Creates or updates an add-on with its service and vehicle compatibility.
 * Add-ons change price, duration and compatibility only; they never add
 * resource consumption in this slice.
 */
final class SaveAddOn
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /**
     * @param  array{name: string, price_centavos: int, duration_minutes: int, is_active: bool}  $attributes
     * @param  list<int>  $serviceIds
     * @param  list<int>  $vehicleTypeIds
     */
    public function handle(Organization $organization, User $actor, ?AddOn $addOn, array $attributes, array $serviceIds, array $vehicleTypeIds): AddOn
    {
        return $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($addOn, $attributes, $serviceIds, $vehicleTypeIds): AddOn {
            if ($addOn === null) {
                $record = new AddOn;
                $record->forceFill(['organization_id' => $locked->id] + $attributes)->save();
                $before = null;
            } else {
                $record = AddOn::query()->where('organization_id', $locked->id)->whereKey($addOn->id)->lockForUpdate()->firstOrFail();
                if ($record->archived_at !== null) {
                    throw ValidationException::withMessages(['record' => 'Archived records cannot be edited.']);
                }
                $before = $record->only(array_keys($attributes)) + [
                    'service_ids' => $record->services()->pluck('services.id')->sort()->values()->all(),
                    'vehicle_type_ids' => $record->vehicleTypes()->pluck('vehicle_types.id')->sort()->values()->all(),
                ];
                $record->fill($attributes)->save();
            }

            $link = fn (array $ids): array => array_fill_keys($ids, ['organization_id' => $locked->id]);
            $record->services()->sync($link($serviceIds));
            $record->vehicleTypes()->sync($link($vehicleTypeIds));

            sort($serviceIds);
            sort($vehicleTypeIds);
            $audit->record($before === null ? 'add_on.created' : 'add_on.updated', 'add_on', $record->id, $before,
                $attributes + ['service_ids' => $serviceIds, 'vehicle_type_ids' => $vehicleTypeIds]);

            return $record;
        });
    }
}
