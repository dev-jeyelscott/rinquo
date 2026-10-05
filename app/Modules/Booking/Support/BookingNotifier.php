<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Mail\BookingMailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Queues booking email only after the surrounding transaction commits, and
 * never lets a mail failure reach the caller: the booking is already durable.
 * Outside a transaction the callback runs immediately.
 */
final class BookingNotifier
{
    /** Queues the mail only when the booking has an address (staff-entered contacts may have none). */
    public static function queueIfAddressed(?string $email, BookingMailable $mail): void
    {
        if ($email !== null && $email !== '') {
            self::queue($email, $mail);
        }
    }

    public static function queue(string $email, BookingMailable $mail): void
    {
        DB::afterCommit(function () use ($email, $mail): void {
            try {
                Mail::to($email)->queue($mail);
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
