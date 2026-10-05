<?php

namespace App\Modules\Booking\Console;

use App\Modules\Booking\Actions\ExpireConflictProposals;
use Illuminate\Console\Command;

class ExpireConflictProposalsCommand extends Command
{
    protected $signature = 'conflicts:expire-proposals';

    protected $description = 'Expire overdue scheduling-conflict proposals (returning the conflict to staff) and close conflicts of ended bookings';

    public function handle(ExpireConflictProposals $expire): int
    {
        $result = $expire->handle();
        $this->info("Expired {$result['expired']} proposal(s) and closed {$result['closed']} conflict(s) of ended bookings.");

        return self::SUCCESS;
    }
}
