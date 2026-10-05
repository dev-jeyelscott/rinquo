<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;

/** Sent when a booking is created awaiting shop approval. */
final class BookingRequestReceivedMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return 'We received your booking request at '.$organization->name;
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return $organization->name.' received your request and will confirm it by '.$booking->pending_expires_at?->setTimezone($booking->branch_timezone)->format('D, M j, g:i A').' (Philippine time). The time is held for you until then.';
    }
}
