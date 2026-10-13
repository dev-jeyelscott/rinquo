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
// Decision 108: an expired 24-hour renewal request is replaced inside the renewal window. Idempotent and provider-bounded.
Schedule::command('subscriptions:regenerate-requests')->everyTenMinutes()->withoutOverlapping();
Schedule::command('organizations:mark-deletion-eligible')->hourly()->withoutOverlapping();
