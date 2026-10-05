<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when a booking is confirmed (instantly, or after the shop approves it). */
final class BookingConfirmedMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Your booking at '.$organization->name.' is confirmed';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'Your booking at '.$organization->name.' is confirmed. We will see you then.';
    }
}
