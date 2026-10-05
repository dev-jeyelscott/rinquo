<?php

namespace App\Modules\Booking\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only operational history of a booking (enforced by a PostgreSQL trigger). */
class BookingOperationEvent extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }
}
