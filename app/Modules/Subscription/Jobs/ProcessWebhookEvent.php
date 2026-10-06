<?php

namespace App\Modules\Subscription\Jobs;

use App\Modules\Subscription\Actions\ApplyPaidPayment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** At-least-once safe: the action is a no-op for an event that is already settled. */
final class ProcessWebhookEvent implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    public int $timeout = 30;

    public function __construct(public readonly int $webhookEventId) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(ApplyPaidPayment $apply): void
    {
        $apply->handle($this->webhookEventId);
    }
}
