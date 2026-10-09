<?php

namespace App\Modules\Customer\Actions;

use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Identity\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Saves (or revives) a platform vehicle for one customer. A vehicle with a plate
 * is identified by that normalized plate; one without is identified by its
 * case-insensitive make/model. Both identities are unique in the database, so a
 * concurrent duplicate save resolves to the same row and the call is idempotent.
 * Existing bookings hold their own snapshot and are never touched.
 */
final class SaveCustomerVehicle
{
    public function handle(User $customer, string $makeModel, ?string $plate = null, ?string $label = null): CustomerVehicle
    {
        $makeModel = trim($makeModel);
        $plate = $plate === null || trim($plate) === '' ? null : strtoupper(trim($plate));

        try {
            return $this->save($customer, $makeModel, $plate, $label);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request saved the same vehicle first; update that row.
            return $this->save($customer, $makeModel, $plate, $label);
        }
    }

    private function save(User $customer, string $makeModel, ?string $plate, ?string $label): CustomerVehicle
    {
        $query = CustomerVehicle::query()->where('user_id', $customer->id);
        $existing = $plate !== null
            ? $query->where('plate', $plate)->first()
            : $query->whereNull('plate')->whereRaw('lower(make_model) = ?', [mb_strtolower($makeModel)])->first();

        $attributes = ['make_model' => $makeModel, 'archived_at' => null] + ($label === null ? [] : ['label' => $label]);

        if ($existing !== null) {
            $existing->forceFill($attributes)->save();

            return $existing;
        }

        return CustomerVehicle::query()->create($attributes + ['user_id' => $customer->id, 'plate' => $plate]);
    }
}
