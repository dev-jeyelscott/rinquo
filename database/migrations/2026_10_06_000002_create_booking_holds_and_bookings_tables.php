<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Checkout holds, bookings and their add-on lines.
 *
 * Capacity is claimed by (physical resource, units, [start, occupied_end)).
 * Live claims are active unexpired holds, confirmed bookings and unexpired
 * pending-approval bookings; the claim logic lives in Booking\Availability and
 * runs under the organization row lock. These tables enforce shape, arithmetic,
 * tenant ownership and (by trigger) the immutability of booking snapshots.
 */
return new class extends Migration
{
    private const SNAPSHOT_COLUMNS = [
        'organization_id', 'public_id', 'hold_id', 'customer_user_id',
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
        Schema::create('booking_holds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->char('session_token_hash', 64)->index();
            $table->uuid('idempotency_key');
            $table->unique(['organization_id', 'idempotency_key']);

            $table->unsignedBigInteger('service_vehicle_variant_id');
            $table->unsignedBigInteger('resource_type_id');
            $table->unsignedBigInteger('physical_resource_id');
            $table->unsignedSmallInteger('units');
            $table->timestampTz('scheduled_start_at');
            $table->timestampTz('service_end_at');
            $table->timestampTz('occupied_end_at');
            $table->jsonb('add_on_ids');

            // Captured at the Details step.
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_phone', 40)->nullable();
            $table->string('vehicle_plate', 20)->nullable();
            $table->text('customer_notes')->nullable();

            $table->string('status', 20)->default('active');
            $table->timestampTz('expires_at');
            $table->timestampsTz();

            $this->parent($table, 'service_vehicle_variant_id', 'service_vehicle_variants');
            $this->parent($table, 'resource_type_id', 'resource_types');
            $this->parent($table, 'physical_resource_id', 'physical_resources');
            $table->index(['physical_resource_id', 'scheduled_start_at', 'occupied_end_at'], 'booking_holds_resource_span_index');
            $table->index(['status', 'expires_at']);
        });
        $this->check('booking_holds', "status IN ('active','converted','released','expired')", 'status');
        $this->check('booking_holds', 'units > 0', 'units');
        $this->check('booking_holds', 'scheduled_start_at < service_end_at AND service_end_at <= occupied_end_at', 'span');

        Schema::create('bookings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('hold_id')->unique();
            $table->foreignId('customer_user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 20);

            // Snapshots: immutable once written (see the trigger below).
            $table->unsignedBigInteger('service_id');
            $table->string('service_name', 120);
            $table->unsignedBigInteger('vehicle_type_id');
            $table->string('vehicle_type_name', 120);
            $table->unsignedBigInteger('service_vehicle_variant_id');
            $table->unsignedInteger('variant_price_centavos');
            $table->unsignedSmallInteger('variant_duration_minutes');
            $table->unsignedSmallInteger('buffer_minutes');
            $table->unsignedInteger('add_ons_price_centavos');
            $table->unsignedInteger('add_ons_duration_minutes');
            $table->unsignedInteger('total_price_centavos');
            $table->unsignedBigInteger('resource_type_id');
            $table->string('resource_type_name', 120);
            $table->unsignedSmallInteger('consumption_units');
            $table->timestampTz('scheduled_start_at');
            $table->timestampTz('service_end_at');
            $table->timestampTz('occupied_end_at');
            $table->string('branch_timezone', 64);
            $table->string('approval_mode', 20);
            $table->jsonb('policy_snapshot');
            $table->string('contact_name', 120);
            $table->string('contact_email');
            $table->string('contact_phone', 40)->nullable();
            $table->string('vehicle_plate', 20)->nullable();
            $table->text('customer_notes')->nullable();

            // Mutable operational state.
            $table->unsignedBigInteger('physical_resource_id');
            $table->timestampTz('pending_expires_at')->nullable();
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('expired_at')->nullable();
            $table->timestampTz('reminder_sent_at')->nullable();
            $table->timestampsTz();

            $this->parent($table, 'hold_id', 'booking_holds');
            $this->parent($table, 'service_id', 'services');
            $this->parent($table, 'vehicle_type_id', 'vehicle_types');
            $this->parent($table, 'service_vehicle_variant_id', 'service_vehicle_variants');
            $this->parent($table, 'resource_type_id', 'resource_types');
            $this->parent($table, 'physical_resource_id', 'physical_resources');
            $table->index(['organization_id', 'scheduled_start_at']);
            $table->index(['physical_resource_id', 'scheduled_start_at', 'occupied_end_at'], 'bookings_resource_span_index');
            $table->index('customer_user_id');
            $table->index(['status', 'pending_expires_at']);
        });
        $this->check('bookings', "status IN ('pending_approval','confirmed','declined','expired')", 'status');
        $this->check('bookings', "approval_mode IN ('auto_confirm','staff_approval')", 'approval_mode');
        $this->check('bookings', 'consumption_units > 0', 'units');
        $this->check('bookings', 'total_price_centavos = variant_price_centavos + add_ons_price_centavos', 'total');
        $this->check('bookings', "service_end_at = scheduled_start_at + (variant_duration_minutes + add_ons_duration_minutes) * interval '1 minute'", 'service_end');
        $this->check('bookings', "occupied_end_at = service_end_at + buffer_minutes * interval '1 minute'", 'occupied_end');
        $this->check('bookings', "status <> 'pending_approval' OR pending_expires_at IS NOT NULL", 'pending_expiry');

        Schema::create('booking_add_ons', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('add_on_id');
            $table->string('name', 120);
            $table->unsignedInteger('price_centavos');
            $table->unsignedSmallInteger('duration_minutes');
            $table->timestampsTz();

            $this->parent($table, 'booking_id', 'bookings');
            $this->parent($table, 'add_on_id', 'add_ons');
            $table->unique(['booking_id', 'add_on_id']);
        });

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
        DB::unprepared('CREATE TRIGGER bookings_snapshot_immutable BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION bookings_reject_snapshot_update()');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION booking_add_ons_reject_change() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'Booking add-on lines are insert-only' USING ERRCODE = 'integrity_constraint_violation';
            END;
            $$ LANGUAGE plpgsql
            SQL);
        DB::unprepared('CREATE TRIGGER booking_add_ons_insert_only BEFORE UPDATE OR DELETE ON booking_add_ons FOR EACH ROW EXECUTE FUNCTION booking_add_ons_reject_change()');
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_add_ons');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('booking_holds');
        DB::unprepared('DROP FUNCTION IF EXISTS bookings_reject_snapshot_update()');
        DB::unprepared('DROP FUNCTION IF EXISTS booking_add_ons_reject_change()');
    }

    private function parent(Blueprint $table, string $column, string $parentTable): void
    {
        $table->foreign(['organization_id', $column])
            ->references(['organization_id', 'id'])
            ->on($parentTable)
            ->restrictOnDelete();
    }

    private function check(string $table, string $expression, string $name): void
    {
        DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_{$name}_check CHECK ({$expression})");
    }
};
