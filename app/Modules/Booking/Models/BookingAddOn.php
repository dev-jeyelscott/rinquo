<?php

namespace App\Modules\Booking\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Insert-only snapshot line of an add-on chosen for a booking.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $booking_id
 * @property int $add_on_id
 * @property string $name
 * @property int $price_centavos
 * @property int $duration_minutes
 */
class BookingAddOn extends Model
{
    protected $guarded = [];
}
