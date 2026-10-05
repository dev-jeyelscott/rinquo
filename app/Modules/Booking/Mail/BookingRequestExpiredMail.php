<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when a pending request passes its response window without a decision. */
final class BookingRequestExpiredMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Your booking request at '.$organization->name.' expired';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'The shop did not respond in time, so your request expired and the time is no longer reserved. You are welcome to book another time.';
    }
}
