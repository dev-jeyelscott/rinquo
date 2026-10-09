<?php

namespace App\Modules\Customer\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * A platform-wide saved vehicle owned by one customer (user). Make/model is
 * null only on rows saved before it was collected; the plate is optional.
 *
 * @property int $id
 * @property int $user_id
 * @property ?string $make_model
 * @property ?string $plate
 * @property ?string $label
 * @property ?CarbonImmutable $archived_at
 */
class CustomerVehicle extends Model
{
    protected $fillable = ['user_id', 'make_model', 'plate', 'label', 'archived_at'];

    protected function casts(): array
    {
        return ['archived_at' => 'immutable_datetime'];
    }
}
