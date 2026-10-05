<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when staff confirm a customer did not arrive for the booking. */
final class BookingNoShowMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'We missed you at '.$organization->name;
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'We did not see you for your booking at '.$organization->name.', so it was marked as a no-show.';
    }
}
