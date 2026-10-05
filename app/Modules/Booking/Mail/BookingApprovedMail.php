<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when the shop approves a pending request. */
final class BookingApprovedMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'Your booking at '.$organization->name.' is confirmed';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return $organization->name.' approved your request. Your booking is confirmed.';
    }
}
