<?php

namespace App\Modules\Subscription\Mail;

use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Base of the Owner billing emails: queued, retried with backoff, dates shown in Philippine time. */
abstract class SubscriptionMailable extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    /** @return list<int> */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    protected static function date(CarbonImmutable $at): string
    {
        return $at->setTimezone((string) config('app.display_timezone'))->format('D, M j, Y \a\t g:i A').' (Philippine time)';
    }

    protected static function money(int $centavos): string
    {
        return '₱'.number_format($centavos / 100, $centavos % 100 === 0 ? 0 : 2);
    }
}
