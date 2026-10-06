<?php

namespace App\Modules\Customer\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerProfile extends Model
{
    protected $fillable = ['user_id', 'name', 'phone'];
}
