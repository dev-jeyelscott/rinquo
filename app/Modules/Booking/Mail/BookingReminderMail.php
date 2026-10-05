<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent once, ahead of a confirmed booking. */
final class BookingReminderMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Reminder: your booking at '.$organization->name;
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'This is a reminder of your upcoming booking at '.$organization->name.'.';
    }
}
