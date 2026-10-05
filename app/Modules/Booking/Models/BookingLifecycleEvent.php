<?php

namespace App\Modules\Booking\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only customer-facing booking lifecycle history. */
class BookingLifecycleEvent extends Model
{
    protected $guarded = [];
}
