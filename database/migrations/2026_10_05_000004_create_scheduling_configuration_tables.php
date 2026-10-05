<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Booking-feasibility configuration. Every table carries organization_id and
 * references its parents through composite (organization_id, id) foreign keys,
 * so PostgreSQL itself rejects a row that points at another tenant's parent.
 * History-bearing records use RESTRICT and are archived, never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_weekly_hours', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('branch_id');
            $table->unsignedTinyInteger('weekday'); // ISO 1 (Monday) to 7 (Sunday)
            $table->time('opens_at'); // branch-local wall clock
            $table->time('closes_at');
            $table->timestampsTz();

            $this->parent($table, 'branch_id', 'branches');
            $table->index(['branch_id', 'weekday']);
        });
        $this->check('branch_weekly_hours', 'weekday BETWEEN 1 AND 7', 'weekday');
        $this->check('branch_weekly_hours', 'opens_at < closes_at', 'interval');

        Schema::create('branch_date_overrides', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('branch_id');
            $table->date('local_date'); // branch-local calendar date
            $table->boolean('is_closed');
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->timestampsTz();

            $this->parent($table, 'branch_id', 'branches');
            $table->unique(['branch_id', 'local_date']);
        });
        $this->check('branch_date_overrides', '(is_closed AND opens_at IS NULL AND closes_at IS NULL) OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)', 'shape');

        foreach (['vehicle_types', 'services', 'add_ons'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name): void {
                $this->tenantKeys($table, withUnique: true);
                $table->string('name', 120);
                if ($name === 'services') {
                    $table->text('description')->nullable();
                }
                if ($name === 'add_ons') {
                    $table->unsignedInteger('price_centavos')->default(0);
                    $table->unsignedSmallInteger('duration_minutes')->default(0);
                }
                $this->lifecycle($table);
                $table->timestampsTz();
            });
            DB::statement("CREATE UNIQUE INDEX {$name}_org_name_unique ON {$name} (organization_id, lower(name)) WHERE archived_at IS NULL");
        }

        Schema::create('service_vehicle_variants', function (Blueprint $table): void {
            $this->tenantKeys($table, withUnique: true);
            $table->unsignedBigInteger('service_id');
            $table->unsignedBigInteger('vehicle_type_id');
            $table->unsignedInteger('price_centavos');
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedSmallInteger('buffer_minutes')->default(0);
            $this->lifecycle($table);
            $table->timestampsTz();

            $this->parent($table, 'service_id', 'services');
            $this->parent($table, 'vehicle_type_id', 'vehicle_types');
            $table->unique(['service_id', 'vehicle_type_id']);
        });
        $this->check('service_vehicle_variants', 'duration_minutes > 0', 'duration');

        Schema::create('add_on_vehicle_options', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('add_on_id');
            $table->unsignedBigInteger('vehicle_type_id');
            $table->timestampsTz();

            $this->parent($table, 'add_on_id', 'add_ons');
            $this->parent($table, 'vehicle_type_id', 'vehicle_types');
            $table->unique(['add_on_id', 'vehicle_type_id']);
        });

        Schema::create('service_add_ons', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('service_id');
            $table->unsignedBigInteger('add_on_id');
            $table->timestampsTz();

            $this->parent($table, 'service_id', 'services');
            $this->parent($table, 'add_on_id', 'add_ons');
            $table->unique(['service_id', 'add_on_id']);
        });

        Schema::create('service_windows', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('service_id');
            $table->unsignedTinyInteger('weekday');
            $table->time('starts_at'); // branch-local wall clock
            $table->time('ends_at');
            $table->timestampsTz();

            $this->parent($table, 'service_id', 'services');
            $table->index(['service_id', 'weekday']);
        });
        $this->check('service_windows', 'weekday BETWEEN 1 AND 7', 'weekday');
        $this->check('service_windows', 'starts_at < ends_at', 'interval');

        Schema::create('resource_types', function (Blueprint $table): void {
            $this->tenantKeys($table, withUnique: true);
            $table->unsignedBigInteger('branch_id');
            $table->string('name', 120);
            $this->lifecycle($table);
            $table->timestampsTz();

            $this->parent($table, 'branch_id', 'branches');
        });
        DB::statement('CREATE UNIQUE INDEX resource_types_org_name_unique ON resource_types (organization_id, lower(name)) WHERE archived_at IS NULL');

        Schema::create('physical_resources', function (Blueprint $table): void {
            $this->tenantKeys($table, withUnique: true);
            $table->unsignedBigInteger('resource_type_id');
            $table->string('name', 120);
            $table->unsignedSmallInteger('capacity');
            $this->lifecycle($table);
            $table->timestampsTz();

            $this->parent($table, 'resource_type_id', 'resource_types');
        });
        $this->check('physical_resources', 'capacity > 0', 'capacity');
        DB::statement('CREATE UNIQUE INDEX physical_resources_type_name_unique ON physical_resources (resource_type_id, lower(name)) WHERE archived_at IS NULL');

        Schema::create('capacity_consumptions', function (Blueprint $table): void {
            $this->tenantKeys($table);
            $table->unsignedBigInteger('service_vehicle_variant_id');
            $table->unsignedBigInteger('resource_type_id');
            $table->unsignedSmallInteger('units');
            $table->timestampsTz();

            $this->parent($table, 'service_vehicle_variant_id', 'service_vehicle_variants');
            $this->parent($table, 'resource_type_id', 'resource_types');
            $table->unique(['organization_id', 'service_vehicle_variant_id', 'resource_type_id'], 'capacity_consumptions_unique_rule');
        });
        $this->check('capacity_consumptions', 'units > 0', 'units');
    }

    public function down(): void
    {
        foreach ([
            'capacity_consumptions', 'physical_resources', 'resource_types', 'service_windows',
            'service_add_ons', 'add_on_vehicle_options', 'service_vehicle_variants', 'add_ons',
            'services', 'vehicle_types', 'branch_date_overrides', 'branch_weekly_hours',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function tenantKeys(Blueprint $table, bool $withUnique = false): void
    {
        $table->id();
        $table->foreignId('organization_id')->constrained()->restrictOnDelete();
        if ($withUnique) {
            $table->unique(['organization_id', 'id']);
        }
    }

    private function lifecycle(Blueprint $table): void
    {
        $table->boolean('is_active')->default(true);
        $table->timestampTz('archived_at')->nullable();
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
