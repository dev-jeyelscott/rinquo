<?php

use Illuminate\Support\Facades\Schedule;

// Horizon metrics (throughput / runtime graphs) are built from snapshots.
Schedule::command('horizon:snapshot')->everyFiveMinutes();

// Idempotent sweepers (conditional updates under the organization lock). Capacity
// frees at expiry through a time predicate, so a missed run never blocks booking.
Schedule::command('bookings:expire')->everyMinute()->withoutOverlapping();
Schedule::command('bookings:send-reminders')->everyMinute()->withoutOverlapping();
Schedule::command('conflicts:expire-proposals')->everyMinute()->withoutOverlapping();

// Subscription reminders and closure eligibility are idempotent and catch up after a missed run.
// Neither toggles a stored restriction flag: restriction is derived from entitlement instants.
Schedule::command('subscriptions:send-reminders')->hourly()->withoutOverlapping();
Schedule::command('organizations:mark-deletion-eligible')->hourly()->withoutOverlapping();
