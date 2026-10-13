<?php

namespace App\Modules\Subscription\Console;

use App\Modules\Subscription\Actions\RegenerateRenewalRequests;
use Illuminate\Console\Command;

class RegenerateRenewalRequestsCommand extends Command
{
    protected $signature = 'subscriptions:regenerate-requests';

    protected $description = 'Open a fresh 24-hour renewal request for organizations inside their renewal window whose previous request expired';

    public function handle(RegenerateRenewalRequests $regenerate): int
    {
        $counts = $regenerate->handle();

        $this->info(sprintf(
            'Candidates %d, created %d, outside window %d, awaiting settlement %d, provider failures %d%s.',
            $counts['candidates'], $counts['created'], $counts['skipped_window'], $counts['skipped_pending_settlement'], $counts['provider_failed'],
            $counts['stopped'] ? ' (stopped early: provider unavailable)' : '',
        ));

        return self::SUCCESS;
    }
}
