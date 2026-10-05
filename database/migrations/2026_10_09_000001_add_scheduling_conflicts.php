<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Scheduling conflicts: an operational layer that sits beside, never inside,
 * the booking lifecycle. A conflict says "this booking can no longer be
 * fulfilled as scheduled"; the booking itself stays confirmed, snapshots stay
 * immutable and the original slot stays reserved until the customer accepts a
 * replacement. A proposal is a temporary, expiring claim on a candidate slot
 * (counted by Booking\Availability\Occupancy) and is never a confirmed booking.
 *
 * PostgreSQL enforces one unresolved conflict and one active proposal per
 * booking (partial unique indexes), tenant ownership (composite foreign keys),
 * legal state/timestamp combinations (CHECKs) and append-only history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduling_conflicts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('booking_id');
            $table->string('status', 20);
            $table->string('resolution', 30)->nullable();
            $table->string('cause', 30);
            $table->string('source', 60);
            // Immutable disruption context: what was changed and the original/new resource ids.
            $table->jsonb('context');
            $table->unsignedBigInteger('original_resource_id');
            $table->unsignedBigInteger('reassigned_resource_id')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('detected_at');
            $table->timestampTz('reopened_at')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'original_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->foreign(['organization_id', 'reassigned_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->index(['organization_id', 'status', 'detected_at'], 'scheduling_conflicts_queue_index');
            $table->index(['booking_id', 'id']);
        });
        DB::statement("ALTER TABLE scheduling_conflicts ADD CONSTRAINT scheduling_conflicts_status_check CHECK (status IN ('open','awaiting_customer','resolved'))");
        DB::statement("ALTER TABLE scheduling_conflicts ADD CONSTRAINT scheduling_conflicts_cause_check CHECK (cause IN ('resource_blocked','resource_unavailable','compatibility','capacity','hours'))");
        DB::statement("ALTER TABLE scheduling_conflicts ADD CONSTRAINT scheduling_conflicts_resolution_check CHECK ((status = 'resolved') = (resolution IS NOT NULL AND resolved_at IS NOT NULL) AND (resolution IS NULL OR resolution IN ('same_time_reassigned','customer_accepted','booking_closed')))");
        DB::statement("ALTER TABLE scheduling_conflicts ADD CONSTRAINT scheduling_conflicts_reassigned_check CHECK ((resolution IS NOT DISTINCT FROM 'same_time_reassigned') = (reassigned_resource_id IS NOT NULL))");
        // One unresolved conflict per booking.
        DB::statement("CREATE UNIQUE INDEX scheduling_conflicts_one_unresolved ON scheduling_conflicts (booking_id) WHERE status <> 'resolved'");

        Schema::create('scheduling_conflict_proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('conflict_id');
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('physical_resource_id');
            $table->unsignedBigInteger('resource_type_id');
            $table->unsignedSmallInteger('units');
            $table->timestampTz('proposed_start_at');
            $table->timestampTz('proposed_service_end_at');
            $table->timestampTz('occupied_end_at');
            $table->string('status', 20)->default('active');
            $table->timestampTz('expires_at');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('responded_at')->nullable();
            $table->unsignedBigInteger('replacement_booking_id')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->timestampsTz();
            $table->foreign(['organization_id', 'conflict_id'])->references(['organization_id', 'id'])->on('scheduling_conflicts')->restrictOnDelete();
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'replacement_booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'physical_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->foreign(['organization_id', 'resource_type_id'])->references(['organization_id', 'id'])->on('resource_types')->restrictOnDelete();
            $table->index(['physical_resource_id', 'proposed_start_at', 'occupied_end_at'], 'conflict_proposals_resource_span_index');
            $table->index(['status', 'expires_at'], 'conflict_proposals_sweep_index');
            $table->index(['conflict_id', 'id']);
        });
        DB::statement("ALTER TABLE scheduling_conflict_proposals ADD CONSTRAINT conflict_proposals_status_check CHECK (status IN ('active','accepted','declined','expired','withdrawn','replaced'))");
        DB::statement('ALTER TABLE scheduling_conflict_proposals ADD CONSTRAINT conflict_proposals_units_check CHECK (units > 0)');
        DB::statement('ALTER TABLE scheduling_conflict_proposals ADD CONSTRAINT conflict_proposals_span_check CHECK (proposed_start_at < proposed_service_end_at AND proposed_service_end_at <= occupied_end_at)');
        DB::statement("ALTER TABLE scheduling_conflict_proposals ADD CONSTRAINT conflict_proposals_response_check CHECK ((status = 'active') = (responded_at IS NULL) AND ((status = 'accepted') = (replacement_booking_id IS NOT NULL)))");
        // One active proposal per booking.
        DB::statement("CREATE UNIQUE INDEX conflict_proposals_one_active ON scheduling_conflict_proposals (booking_id) WHERE status = 'active'");

        Schema::create('scheduling_conflict_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('conflict_id');
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('proposal_id')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('actor_type', 10);
            $table->string('event', 30);
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->jsonb('details')->nullable();
            $table->timestampsTz();
            $table->index(['conflict_id', 'id']);
            $table->foreign(['organization_id', 'conflict_id'])->references(['organization_id', 'id'])->on('scheduling_conflicts')->restrictOnDelete();
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'proposal_id'])->references(['organization_id', 'id'])->on('scheduling_conflict_proposals')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE scheduling_conflict_events ADD CONSTRAINT scheduling_conflict_events_actor_check CHECK (actor_type IN ('staff','customer','system'))");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION scheduling_conflict_events_reject_change() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'Scheduling conflict events are append-only' USING ERRCODE = 'integrity_constraint_violation';
            END;
            $$ LANGUAGE plpgsql
            SQL);
        DB::unprepared('CREATE TRIGGER scheduling_conflict_events_append_only BEFORE UPDATE OR DELETE ON scheduling_conflict_events FOR EACH ROW EXECUTE FUNCTION scheduling_conflict_events_reject_change()');

        Schema::create('scheduling_conflict_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('conflict_id');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('operation', 30);
            $table->char('request_hash', 64);
            $table->unsignedBigInteger('result_booking_id')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'idempotency_key']);
            $table->foreign(['organization_id', 'conflict_id'])->references(['organization_id', 'id'])->on('scheduling_conflicts')->restrictOnDelete();
            $table->foreign(['organization_id', 'result_booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Scheduling conflict migrations are irreversible once conflict history exists.');
    }
};
