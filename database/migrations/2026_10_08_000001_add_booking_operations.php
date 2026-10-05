<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Staff operations: operational state on bookings, staff-entered bookings
 * without a platform identity, resource blocks, append-only operation history,
 * idempotent operation requests and durable notification failures.
 *
 * The fulfillment snapshot stays immutable. Operational facts (state, actual
 * timings, actual resource, capacity release, queue priority) are mutable and
 * versioned by operation_revision. A staff-entered contact is plain contact
 * data: customer_user_id stays NULL, so it can never claim or create an account.
 */
return new class extends Migration
{
    private const SNAPSHOT_COLUMNS = [
        'organization_id', 'public_id', 'hold_id', 'customer_user_id', 'source',
        'service_id', 'service_name', 'vehicle_type_id', 'vehicle_type_name', 'service_vehicle_variant_id',
        'variant_price_centavos', 'variant_duration_minutes', 'buffer_minutes',
        'add_ons_price_centavos', 'add_ons_duration_minutes', 'total_price_centavos',
        'resource_type_id', 'resource_type_name', 'consumption_units',
        'scheduled_start_at', 'service_end_at', 'occupied_end_at', 'branch_timezone',
        'approval_mode', 'policy_snapshot',
        'contact_name', 'contact_email', 'contact_phone', 'vehicle_plate', 'customer_notes',
    ];

    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->string('source', 20)->default('online');
            $table->string('operational_state', 20)->default('scheduled');
            $table->unsignedInteger('operation_revision')->default(1);
            $table->timestampTz('checked_in_at')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('no_show_at')->nullable();
            $table->unsignedBigInteger('actual_resource_id')->nullable();
            $table->timestampTz('capacity_release_at')->nullable();
            $table->timestampTz('queue_priority_at')->nullable();
            $table->foreign(['organization_id', 'actual_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->index(['organization_id', 'scheduled_start_at', 'operational_state'], 'bookings_operations_day_index');
        });

        DB::statement('ALTER TABLE bookings ALTER COLUMN customer_user_id DROP NOT NULL');
        DB::statement('ALTER TABLE bookings ALTER COLUMN contact_email DROP NOT NULL');
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_source_check CHECK (source IN ('online','staff','walk_in'))");
        // Online bookings keep their verified customer; staff-entered ones never link an account.
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_source_identity_check CHECK ((source = 'online' AND customer_user_id IS NOT NULL AND contact_email IS NOT NULL) OR (source <> 'online' AND customer_user_id IS NULL))");
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT bookings_operational_state_check CHECK (operational_state IN ('scheduled','checked_in','in_service','completed','no_show'))");
        DB::statement(<<<'SQL'
            ALTER TABLE bookings ADD CONSTRAINT bookings_operational_facts_check CHECK (
                (operational_state = 'scheduled' AND checked_in_at IS NULL AND started_at IS NULL AND completed_at IS NULL AND no_show_at IS NULL AND capacity_release_at IS NULL)
                OR (operational_state = 'checked_in' AND checked_in_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND no_show_at IS NULL AND capacity_release_at IS NULL)
                OR (operational_state = 'in_service' AND checked_in_at IS NOT NULL AND started_at IS NOT NULL AND actual_resource_id IS NOT NULL AND completed_at IS NULL AND no_show_at IS NULL AND capacity_release_at IS NULL)
                OR (operational_state = 'completed' AND checked_in_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NOT NULL AND completed_at >= started_at AND actual_resource_id IS NOT NULL AND capacity_release_at IS NOT NULL AND no_show_at IS NULL)
                OR (operational_state = 'no_show' AND no_show_at IS NOT NULL AND capacity_release_at IS NOT NULL AND checked_in_at IS NULL AND started_at IS NULL AND completed_at IS NULL)
            )
            SQL);

        $changed = implode(' OR ', array_map(
            fn (string $column): string => "NEW.{$column} IS DISTINCT FROM OLD.{$column}",
            self::SNAPSHOT_COLUMNS,
        ));
        DB::unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION bookings_reject_snapshot_update() RETURNS trigger AS \$\$
            BEGIN
                IF {$changed} THEN
                    RAISE EXCEPTION 'Booking snapshot columns are immutable' USING ERRCODE = 'integrity_constraint_violation';
                END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql
            SQL);

        Schema::create('resource_blocks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('physical_resource_id');
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('reason', 500);
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('released_at')->nullable();
            $table->foreignId('released_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampsTz();
            $table->foreign(['organization_id', 'physical_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->index(['physical_resource_id', 'starts_at', 'ends_at'], 'resource_blocks_span_index');
        });
        DB::statement('ALTER TABLE resource_blocks ADD CONSTRAINT resource_blocks_span_check CHECK (starts_at < ends_at)');
        DB::statement('ALTER TABLE resource_blocks ADD CONSTRAINT resource_blocks_release_check CHECK ((released_at IS NULL) = (released_by_user_id IS NULL))');

        Schema::create('booking_operation_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('operation', 30);
            $table->string('from_state', 20)->nullable();
            $table->string('to_state', 20);
            $table->unsignedBigInteger('from_resource_id')->nullable();
            $table->unsignedBigInteger('to_resource_id')->nullable();
            $table->string('reason', 500)->nullable();
            $table->unsignedInteger('operation_revision');
            $table->jsonb('details')->nullable();
            $table->timestampsTz();
            $table->index(['booking_id', 'id']);
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
            $table->foreign(['organization_id', 'from_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
            $table->foreign(['organization_id', 'to_resource_id'])->references(['organization_id', 'id'])->on('physical_resources')->restrictOnDelete();
        });
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION booking_operation_events_reject_change() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'Booking operation events are append-only' USING ERRCODE = 'integrity_constraint_violation';
            END;
            $$ LANGUAGE plpgsql
            SQL);
        DB::unprepared('CREATE TRIGGER booking_operation_events_append_only BEFORE UPDATE OR DELETE ON booking_operation_events FOR EACH ROW EXECUTE FUNCTION booking_operation_events_reject_change()');

        Schema::create('booking_operation_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('operation', 30);
            $table->char('request_hash', 64);
            $table->timestampsTz();
            $table->unique(['organization_id', 'idempotency_key']);
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });

        Schema::create('operational_notification_failures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('booking_id');
            $table->string('mail_type', 60);
            $table->string('status', 20)->default('failed');
            $table->string('error_class', 160);
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->timestampTz('failed_at');
            $table->timestampTz('last_retried_at')->nullable();
            $table->foreignId('last_retried_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'booking_id', 'mail_type']);
            $table->index(['organization_id', 'status']);
            $table->foreign(['organization_id', 'booking_id'])->references(['organization_id', 'id'])->on('bookings')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE operational_notification_failures ADD CONSTRAINT operational_notification_failures_status_check CHECK (status IN ('failed','retrying','resolved'))");
    }

    public function down(): void
    {
        throw new RuntimeException('Booking operations migrations are irreversible once operational history exists.');
    }
};
