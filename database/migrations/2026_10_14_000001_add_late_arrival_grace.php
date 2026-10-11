<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Late-arrival grace (Locked Decisions 8, 20, 117-118).
 *
 * Each organization's booking policy gets a whole-minute grace period (default
 * the locked 15) after which a customer who has not arrived becomes eligible to
 * be confirmed as a no-show. A booking that arrives after that deadline stays
 * confirmed and records late_arrival_at, an operational fact like check-in; it
 * is not part of the immutable snapshot, so the snapshot trigger is untouched.
 * New policy snapshots carry the grace in their JSON; historical rows without
 * the key read as the locked default. Expand-only: both columns are additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_policies', fn (Blueprint $table) => $table->unsignedSmallInteger('late_arrival_grace_minutes')->default(15));
        DB::statement('ALTER TABLE booking_policies ADD CONSTRAINT booking_policies_late_arrival_grace_check CHECK (late_arrival_grace_minutes BETWEEN 1 AND 120)');

        Schema::table('bookings', fn (Blueprint $table) => $table->timestampTz('late_arrival_at')->nullable());
        DB::statement('ALTER TABLE bookings ADD CONSTRAINT bookings_late_arrival_facts_check CHECK (late_arrival_at IS NULL OR (checked_in_at IS NOT NULL AND late_arrival_at >= scheduled_start_at))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_late_arrival_facts_check');
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn('late_arrival_at'));
        DB::statement('ALTER TABLE booking_policies DROP CONSTRAINT IF EXISTS booking_policies_late_arrival_grace_check');
        Schema::table('booking_policies', fn (Blueprint $table) => $table->dropColumn('late_arrival_grace_minutes'));
    }
};
