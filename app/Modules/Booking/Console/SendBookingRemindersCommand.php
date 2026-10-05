<?php

namespace App\Modules\Booking\Console;

use App\Modules\Booking\Actions\SendBookingReminders;
use Illuminate\Console\Command;

class SendBookingRemindersCommand extends Command
{
    protected $signature = 'bookings:send-reminders';

    protected $description = 'Send each confirmed booking reminder exactly once';

    public function handle(SendBookingReminders $reminders): int
    {
        $this->info("Queued {$reminders->handle()} reminder(s).");

        return self::SUCCESS;
    }
}
