<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when staff record a booking's service as complete. */
final class BookingCompletedMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Your service at '.$organization->name.' is complete';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return 'Your service at '.$organization->name.' is complete. Thank you for visiting.';
    }
}
