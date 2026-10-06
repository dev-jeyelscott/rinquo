<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Subscription entitlement, PayMongo payment requests, signed-webhook receipts,
 * confirmed payments (the entitlement events) and reminder deliveries. All
 * instants are UTC timestamptz. Entitlement is derived from the snapshotted
 * instants on `subscriptions`; nothing stores a "restricted" flag.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->restrictOnDelete();
            $table->timestampTz('trial_ends_at');
            $table->timestampTz('paid_until')->nullable();
            $table->timestampTz('grace_ends_at');
            $table->timestampsTz();
            $table->unique(['organization_id', 'id']);
        });
        DB::statement('ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_paid_after_trial CHECK (paid_until IS NULL OR paid_until > trial_ends_at)');
        DB::statement('ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_grace_after_access CHECK (grace_ends_at > COALESCE(paid_until, trial_ends_at) AND grace_ends_at > trial_ends_at)');

        Schema::create('subscription_payment_requests', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->unsignedBigInteger('organization_id');
            $table->unsignedBigInteger('subscription_id');
            $table->unsignedBigInteger('amount_centavos');
            $table->string('currency', 3);
            $table->unsignedSmallInteger('period_months')->default(1);
            $table->string('provider_mode', 4);
            $table->string('status', 10)->default('open');
            $table->timestampTz('expires_at');
            $table->string('provider_payment_intent_id', 80)->nullable()->unique();
            $table->string('provider_payment_method_id', 80)->nullable();
            $table->text('qr_image')->nullable();
            $table->unsignedSmallInteger('qr_generation')->default(0);
            $table->timestampTz('qr_expires_at')->nullable();
            $table->string('last_provider_error', 160)->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampsTz();

            $table->foreign(['organization_id', 'subscription_id'])->references(['organization_id', 'id'])->on('subscriptions')->restrictOnDelete();
            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'status']);
        });
        DB::statement('ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_amount_positive CHECK (amount_centavos > 0)');
        DB::statement("ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_currency CHECK (currency IN ('PHP'))");
        DB::statement('ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_one_month CHECK (period_months = 1)');
        DB::statement("ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_mode CHECK (provider_mode IN ('test', 'live'))");
        DB::statement("ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_status CHECK (status IN ('open', 'paid', 'expired'))");
        DB::statement("ALTER TABLE subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_paid_coherent CHECK ((status = 'paid') = (paid_at IS NOT NULL))");
        // One open renewal request per organization: double clicks and the scheduler reuse it.
        DB::statement("CREATE UNIQUE INDEX subscription_payment_requests_one_open ON subscription_payment_requests (organization_id) WHERE status = 'open'");

        Schema::create('subscription_payments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('organization_id');
            $table->unsignedBigInteger('subscription_id');
            $table->unsignedBigInteger('payment_request_id')->unique();
            $table->string('provider_payment_id', 80)->unique();
            $table->string('provider_payment_intent_id', 80);
            $table->unsignedBigInteger('amount_centavos');
            $table->string('currency', 3);
            $table->string('provider_mode', 4);
            $table->timestampTz('paid_at');
            $table->timestampTz('period_starts_at');
            $table->timestampTz('paid_until');
            $table->timestampTz('grace_ends_at');
            $table->timestampTz('created_at');

            $table->foreign(['organization_id', 'subscription_id'])->references(['organization_id', 'id'])->on('subscriptions')->restrictOnDelete();
            $table->foreign(['organization_id', 'payment_request_id'])->references(['organization_id', 'id'])->on('subscription_payment_requests')->restrictOnDelete();
            $table->index(['organization_id', 'paid_at']);
        });
        DB::statement('ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_amount_positive CHECK (amount_centavos > 0)');
        DB::statement('ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_period_ordered CHECK (paid_until > period_starts_at AND grace_ends_at > paid_until)');

        // Only fields needed to process or later audit an event; never the raw body or any secret.
        Schema::create('subscription_webhook_events', function (Blueprint $table): void {
            $table->id();
            $table->string('provider_event_id', 80)->unique();
            $table->string('event_type', 80);
            $table->boolean('livemode');
            $table->string('status', 10)->default('received');
            $table->string('reason', 80)->nullable();
            $table->unsignedBigInteger('organization_id')->nullable();
            $table->unsignedBigInteger('payment_request_id')->nullable();
            $table->string('provider_payment_intent_id', 80)->nullable();
            $table->string('provider_payment_id', 80)->nullable();
            $table->unsignedBigInteger('amount_centavos')->nullable();
            $table->string('currency', 3)->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->timestampTz('received_at');
            $table->timestampTz('processed_at')->nullable();
            $table->index('status');
        });
        DB::statement("ALTER TABLE subscription_webhook_events ADD CONSTRAINT subscription_webhook_events_status CHECK (status IN ('received', 'processed', 'ignored', 'rejected'))");

        Schema::create('subscription_reminder_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            // The entitlement cycle: the instant access ends. An early renewal moves it, so it opens a new cycle.
            $table->timestampTz('entitlement_ends_at');
            $table->unsignedSmallInteger('offset_days');
            $table->string('status', 10);
            $table->timestampTz('sent_at')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'entitlement_ends_at', 'offset_days'], 'subscription_reminders_unique_per_cycle');
        });
        DB::statement("ALTER TABLE subscription_reminder_deliveries ADD CONSTRAINT subscription_reminders_status CHECK (status IN ('pending', 'sent', 'skipped'))");

        // Existing organizations get a deployment-time trial, never a retroactive restriction.
        $trialDays = max(1, (int) config('rinquo.subscription.trial_days', 14));
        $graceDays = max(1, (int) config('rinquo.subscription.grace_days', 7));
        DB::statement(
            'INSERT INTO subscriptions (organization_id, trial_ends_at, grace_ends_at, created_at, updated_at)
             SELECT id, now() + make_interval(days => ?), now() + make_interval(days => ?), now(), now() FROM organizations',
            [$trialDays, $trialDays + $graceDays],
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_reminder_deliveries');
        Schema::dropIfExists('subscription_webhook_events');
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('subscription_payment_requests');
        Schema::dropIfExists('subscriptions');
    }
};
