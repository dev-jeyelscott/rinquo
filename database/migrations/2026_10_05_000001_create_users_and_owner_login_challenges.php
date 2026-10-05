<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('email')->unique();
            $table->timestampTz('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestampsTz();
        });

        // One identity per normalized (lowercase, trimmed) email address.
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)))');

        Schema::create('owner_login_challenges', function (Blueprint $table): void {
            $table->id();
            $table->string('email')->index();
            // SHA-256 of the random browser-bound token. The raw token lives
            // only in the requesting browser's session.
            $table->string('token_hash', 64)->unique();
            // HMAC of the six-digit code. The raw code is only ever emailed.
            $table->string('code_hash', 64);
            $table->unsignedSmallInteger('failed_attempts')->default(0);
            $table->timestampTz('sent_at');
            $table->timestampTz('expires_at');
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_login_challenges');
        Schema::dropIfExists('users');
    }
};
