<?php

namespace App\Modules\Subscription\Models;

use Illuminate\Database\Eloquent\Model;

/** One reminder per (organization, entitlement cycle, offset): the unique key is the dedupe. */
class ReminderDelivery extends Model
{
    public const PENDING = 'pending';

    public const SENT = 'sent';

    public const SKIPPED = 'skipped';

    protected $table = 'subscription_reminder_deliveries';

    protected function casts(): array
    {
        return ['entitlement_ends_at' => 'immutable_datetime', 'sent_at' => 'immutable_datetime'];
    }
}
