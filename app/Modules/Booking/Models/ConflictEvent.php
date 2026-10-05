<?php

namespace App\Modules\Booking\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only history of a scheduling conflict (enforced by a PostgreSQL trigger). */
class ConflictEvent extends Model
{
    protected $table = 'scheduling_conflict_events';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }
}
