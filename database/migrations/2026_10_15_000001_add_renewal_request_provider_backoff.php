<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Expand-only: bounded provider retry bookkeeping for automatic renewal-request regeneration (Decision 108). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_payment_requests', function (Blueprint $table): void {
            $table->unsignedSmallInteger('provider_attempts')->default(0);
            $table->timestampTz('next_provider_attempt_at')->nullable();
        });
    }
};
