<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * The Owner-set booking policy: approval mode and the time rules that govern
 * availability. One row per organization. Code reads it with firstOrFail and
 * never falls back to silent defaults, so every organization gets its row here
 * (backfill) or in CreateOrganization.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_policies', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->string('approval_mode', 20)->default('auto_confirm');
            $table->unsignedSmallInteger('slot_interval_minutes')->default(15);
            $table->unsignedInteger('min_notice_minutes')->default(60);
            $table->unsignedSmallInteger('horizon_days')->default(30);
            $table->unsignedSmallInteger('approval_window_minutes')->default(120);
            $table->timestampsTz();
        });

        $this->check('approval_mode', "approval_mode IN ('auto_confirm','staff_approval')");
        $this->check('slot_interval', 'slot_interval_minutes IN (5,10,15,20,30,60)');
        $this->check('min_notice', 'min_notice_minutes BETWEEN 0 AND 10080');
        $this->check('horizon', 'horizon_days BETWEEN 1 AND 365');
        $this->check('approval_window', 'approval_window_minutes BETWEEN 15 AND 1440');

        DB::statement('INSERT INTO booking_policies (organization_id, created_at, updated_at) SELECT id, now(), now() FROM organizations');
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_policies');
    }

    private function check(string $name, string $expression): void
    {
        DB::statement("ALTER TABLE booking_policies ADD CONSTRAINT booking_policies_{$name}_check CHECK ({$expression})");
    }
};
