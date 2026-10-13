<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent once, about 30 minutes before a confirmed booking's expected start (Decision 213). */
final class BookingReminderMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Reminder: your booking at '.$organization->name;
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'Your booking at '.$organization->name.' starts at '
            .$booking->expectedStartAt()->setTimezone($booking->branch_timezone)->format('g:i A')
            .' (Philippine time).';
    }
}
