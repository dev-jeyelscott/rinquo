<?php

use Illuminate\Support\Facades\Schedule;

// Horizon metrics (throughput / runtime graphs) are built from snapshots.
Schedule::command('horizon:snapshot')->everyFiveMinutes();

// Idempotent sweepers (conditional updates under the organization lock). Capacity
// frees at expiry through a time predicate, so a missed run never blocks booking.
Schedule::command('bookings:expire')->everyMinute()->withoutOverlapping();
Schedule::command('bookings:send-reminders')->everyMinute()->withoutOverlapping();
