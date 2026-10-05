<?php

namespace App\Modules\Booking\Console;

use App\Modules\Booking\Actions\ExpireBookings;
use Illuminate\Console\Command;

class ExpireBookingsCommand extends Command
{
    protected $signature = 'bookings:expire';

    protected $description = 'Expire stale checkout holds and pending booking requests, and notify customers';

    public function handle(ExpireBookings $expire): int
    {
        $result = $expire->handle();
        $this->info("Expired {$result['holds']} hold(s) and {$result['requests']} pending request(s).");

        return self::SUCCESS;
    }
}
