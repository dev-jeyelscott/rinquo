<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Explicit Owner closure: an independent retention lifecycle. Nothing here
 * references subscription or payment state, and billing code never writes it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_closures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('requested_at');
            $table->timestampTz('recoverable_until');
            $table->timestampTz('recovered_at')->nullable();
            $table->foreignId('recovered_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('deletion_eligible_at')->nullable();
            $table->timestampsTz();
            $table->index(['organization_id', 'requested_at']);
        });
        DB::statement('ALTER TABLE organization_closures ADD CONSTRAINT organization_closures_deadline_after_request CHECK (recoverable_until > requested_at)');
        DB::statement('ALTER TABLE organization_closures ADD CONSTRAINT organization_closures_recovery_coherent CHECK ((recovered_at IS NULL) = (recovered_by_user_id IS NULL) AND (recovered_at IS NULL OR (recovered_at >= requested_at AND recovered_at <= recoverable_until)))');
        DB::statement('ALTER TABLE organization_closures ADD CONSTRAINT organization_closures_eligibility_coherent CHECK (deletion_eligible_at IS NULL OR (recovered_at IS NULL AND deletion_eligible_at >= recoverable_until))');
        // At most one unrecovered closure per organization.
        DB::statement('CREATE UNIQUE INDEX organization_closures_one_unrecovered ON organization_closures (organization_id) WHERE recovered_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_closures');
    }
};
