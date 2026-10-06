<?php

namespace App\Modules\Subscription\Console;

use App\Modules\Subscription\Actions\SendRenewalReminders;
use Illuminate\Console\Command;

class SubscriptionLifecycleCommand extends Command
{
    protected $signature = 'subscriptions:send-reminders';

    protected $description = 'Send each organization one renewal reminder per threshold and cycle, and prepare its renewal request';

    public function handle(SendRenewalReminders $reminders): int
    {
        $this->info("Queued {$reminders->handle()} renewal reminder(s).");

        return self::SUCCESS;
    }
}
