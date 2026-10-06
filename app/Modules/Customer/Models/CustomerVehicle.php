<?php

namespace App\Modules\Customer\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerVehicle extends Model
{
    protected $fillable = ['user_id', 'plate', 'label', 'archived_at'];

    protected function casts(): array
    {
        return ['archived_at' => 'immutable_datetime'];
    }
}
