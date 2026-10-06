<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('name', 120)->nullable();
            $table->string('phone', 40)->nullable();
            $table->timestampsTz();
        });

        Schema::create('customer_vehicles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('plate', 20);
            $table->string('label', 120)->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'archived_at']);
            $table->unique(['user_id', 'plate']);
        });
        DB::statement('ALTER TABLE customer_vehicles ADD CONSTRAINT customer_vehicles_plate_normalized CHECK (plate = upper(btrim(plate)))');

        Schema::create('customer_email_change_challenges', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('new_email');
            $table->string('token_hash', 64)->unique();
            $table->string('code_hash', 64);
            $table->unsignedSmallInteger('failed_attempts')->default(0);
            $table->timestampTz('sent_at');
            $table->timestampTz('expires_at');
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'expires_at']);
        });

        Schema::table('organizations', function (Blueprint $table): void {
            $table->boolean('directory_opted_in')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('directory_opted_in'));
        Schema::dropIfExists('customer_email_change_challenges');
        Schema::dropIfExists('customer_vehicles');
        Schema::dropIfExists('customer_profiles');
    }
};
