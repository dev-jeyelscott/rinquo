<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('cancelled_at')->nullable();
            $table->foreignId('cancelled_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('rescheduled_to_booking_id')->nullable();
            $table->unique('rescheduled_to_booking_id');
            // Same-organization lineage: a booking can never point at another tenant's booking.
            $table->foreign(['organization_id', 'rescheduled_to_booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE bookings DROP CONSTRAINT bookings_status_check');
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending_approval','confirmed','declined','expired','cancelled','rescheduled'))");
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_rescheduled_link_check CHECK ((status = 'rescheduled') = (rescheduled_to_booking_id IS NOT NULL) AND rescheduled_to_booking_id IS DISTINCT FROM id)");
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_cancelled_fields_check CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL))");
        Schema::create('booking_lifecycle_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('operation', 20);
            $table->string('from_status', 20);
            $table->string('to_status', 20);
            $table->string('reason', 500)->nullable();
            $table->unsignedInteger('revision');
            $table->timestampsTz();
            $table->index(['booking_id', 'id']);
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });
        Schema::create('booking_lifecycle_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('operation', 20);
            $table->char('request_hash', 64);
            $table->unsignedBigInteger('result_booking_id')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'idempotency_key']);
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'result_booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Booking lifecycle migrations are irreversible once lifecycle history exists.');
    }
};
