<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Vehicle make/model (Locked Decision 23) on holds, booking snapshots and
 * platform saved vehicles.
 *
 * Expand-only and backward compatible: every column is nullable because
 * historical rows have no honest value, and none is invented for them. New
 * application writes require it. The booking column joins the immutable
 * snapshot set, so the trigger is replaced with the previous column list plus
 * vehicle_make_model. A saved vehicle's plate becomes optional (a make/model
 * alone is a vehicle); plates stay normalized and unique per user, and a
 * plateless vehicle is unique per user by its normalized make/model.
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
        'vehicle_make_model',
    ];

    public function up(): void
    {
        Schema::table('booking_holds', fn (Blueprint $table) => $table->string('vehicle_make_model', 120)->nullable());
        Schema::table('bookings', fn (Blueprint $table) => $table->string('vehicle_make_model', 120)->nullable());
        Schema::table('customer_vehicles', fn (Blueprint $table) => $table->string('make_model', 120)->nullable());

        DB::statement('ALTER TABLE customer_vehicles ALTER COLUMN plate DROP NOT NULL');
        DB::statement('CREATE UNIQUE INDEX customer_vehicles_user_plateless_model_unique ON customer_vehicles (user_id, lower(make_model)) WHERE plate IS NULL AND make_model IS NOT NULL');

        $this->replaceSnapshotTrigger(self::SNAPSHOT_COLUMNS);
    }

    public function down(): void
    {
        $this->replaceSnapshotTrigger(array_values(array_diff(self::SNAPSHOT_COLUMNS, ['vehicle_make_model'])));

        DB::statement('DROP INDEX IF EXISTS customer_vehicles_user_plateless_model_unique');
        DB::statement('DELETE FROM customer_vehicles WHERE plate IS NULL');
        DB::statement('ALTER TABLE customer_vehicles ALTER COLUMN plate SET NOT NULL');

        Schema::table('customer_vehicles', fn (Blueprint $table) => $table->dropColumn('make_model'));
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn('vehicle_make_model'));
        Schema::table('booking_holds', fn (Blueprint $table) => $table->dropColumn('vehicle_make_model'));
    }

    /** @param  list<literal-string>  $columns */
    private function replaceSnapshotTrigger(array $columns): void
    {
        $changed = implode(' OR ', array_map(
            fn (string $column): string => "NEW.{$column} IS DISTINCT FROM OLD.{$column}",
            $columns,
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
    }
};
