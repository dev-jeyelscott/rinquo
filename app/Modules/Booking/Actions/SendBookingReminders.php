<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Mail\BookingReminderMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Support\BookingNotifier;
use Carbon\CarbonImmutable;

/**
 * Sends each confirmed booking's reminder at most once. A booking is claimed
 * with a conditional reminder_sent_at update before its mail is queued, so
 * repeated or concurrent runs cannot double-send. Bookings confirmed inside the
 * reminder window already know the time and are skipped.
 */
final class SendBookingReminders
{
    private const BATCH = 200;

    public function handle(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();
        $hours = (int) config('rinquo.booking.reminder_hours_before');
        $sent = 0;

        $due = Booking::query()
            ->where('status', Booking::CONFIRMED)
            ->whereNull('reminder_sent_at')
            ->where('scheduled_start_at', '>', $now)
            ->where('scheduled_start_at', '<=', $now->addHours($hours))
            ->whereRaw("confirmed_at < scheduled_start_at - (? * interval '1 hour')", [$hours])
            ->orderBy('id')
            ->limit(self::BATCH)
            ->get(['id', 'contact_email']);

        foreach ($due as $booking) {
            $claimed = Booking::query()
                ->whereKey($booking->id)
                ->where('status', Booking::CONFIRMED)
                ->whereNull('reminder_sent_at')
                ->update(['reminder_sent_at' => $now, 'updated_at' => $now]);

            if ($claimed === 1) {
                $sent++;
                BookingNotifier::queue($booking->contact_email, new BookingReminderMail($booking->id));
            }
        }

        return $sent;
    }
}
