<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Decision 213 replaces the 24-hour reminder with one 30 minutes before the
 * start. Upcoming bookings that already received the old email would otherwise
 * never get the new one, so their claim is cleared. Idempotent and data-only;
 * reminder_sent_at is not a snapshot column, so the immutability trigger allows it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE bookings
            SET reminder_sent_at = NULL
            WHERE status = 'confirmed'
              AND reminder_sent_at IS NOT NULL
              AND operational_state = 'scheduled'
              AND scheduled_start_at > now() + interval '30 minutes'
            SQL);
    }

    public function down(): void
    {
        // The cleared claims are not restored: the old 24-hour rule no longer exists.
    }
};
