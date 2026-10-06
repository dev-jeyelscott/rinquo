<?php

namespace App\Modules\Tenancy\Console;

use App\Modules\Tenancy\Actions\MarkClosuresDeletionEligible;
use Illuminate\Console\Command;

class MarkDeletionEligibleCommand extends Command
{
    protected $signature = 'organizations:mark-deletion-eligible';

    protected $description = 'Mark closed organizations whose recovery window ended as deletion-eligible (never deletes data)';

    public function handle(MarkClosuresDeletionEligible $mark): int
    {
        $this->info("Marked {$mark->handle()} closure(s) deletion-eligible.");

        return self::SUCCESS;
    }
}
