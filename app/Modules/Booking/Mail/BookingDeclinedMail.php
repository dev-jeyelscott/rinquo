<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when the shop declines a pending request. */
final class BookingDeclinedMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Your booking request at '.$organization->name.' was declined';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return $organization->name.' could not accept your request, and the time is no longer reserved. You are welcome to book another time.';
    }
}
