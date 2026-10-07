<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform administration: a dedicated identity (never a tenant user), its
 * invitations and recovery codes, the append-only platform audit stream,
 * read-only support sessions, versioned subscription terms and the retry ledger
 * for failed queue jobs. Forward-only and additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_admins', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 254)->unique();
            $table->string('name', 120);
            $table->string('password');
            $table->string('status', 16)->default('active');
            // Bumped on disable, password reset and factor reset: every session carries the value it was created with.
            $table->unsignedInteger('session_generation')->default(1);
            // Encrypted by the model cast; null until the factor is confirmed or after a factor reset.
            $table->text('totp_secret')->nullable();
            $table->timestampTz('totp_confirmed_at')->nullable();
            // Highest accepted time-step: a code can never be replayed.
            $table->unsignedBigInteger('totp_last_step')->default(0);
            $table->timestampTz('password_changed_at')->nullable();
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampTz('disabled_at')->nullable();
            $table->foreignId('created_by_admin_id')->nullable()->constrained('platform_admins')->restrictOnDelete();
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE platform_admins ADD CONSTRAINT platform_admins_status CHECK (status IN ('active', 'disabled'))");

        Schema::create('platform_password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestampTz('created_at')->nullable();
        });

        Schema::create('platform_admin_invitations', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 254);
            // SHA-256 of the emailed token; the token itself is never stored.
            $table->string('token_digest', 64)->unique();
            $table->foreignId('invited_by_admin_id')->constrained('platform_admins')->restrictOnDelete();
            $table->timestampTz('expires_at');
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampTz('created_at');

            $table->index('email');
        });

        Schema::create('platform_admin_recovery_codes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('platform_admin_id')->constrained()->cascadeOnDelete();
            $table->string('code_digest', 64);
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampTz('created_at');

            $table->unique(['platform_admin_id', 'code_digest']);
        });

        Schema::create('platform_audit_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_admin_id')->nullable()->constrained('platform_admins')->restrictOnDelete();
            $table->string('event', 80);
            $table->string('result', 24);
            $table->string('subject_type', 60)->nullable();
            $table->string('subject_id', 64)->nullable();
            $table->string('route', 120)->nullable();
            $table->string('correlation_id', 64)->nullable();
            // Allowlisted semantic values only: never secrets, request bodies, queries or customer data.
            $table->jsonb('metadata')->nullable();
            $table->timestampTz('created_at');

            $table->index(['created_at']);
            $table->index(['actor_admin_id', 'created_at']);
            $table->index(['event', 'created_at']);
        });
        // Append-only is enforced by the database, not only by the application.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION platform_audit_events_immutable() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'platform_audit_events is append-only';
            END;
            $$ LANGUAGE plpgsql
        SQL);
        DB::unprepared('CREATE TRIGGER platform_audit_events_no_change BEFORE UPDATE OR DELETE ON platform_audit_events FOR EACH ROW EXECUTE FUNCTION platform_audit_events_immutable()');

        Schema::create('support_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('platform_admin_id')->constrained()->restrictOnDelete();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('target_user_id')->constrained('users')->restrictOnDelete();
            $table->string('reason', 500);
            $table->string('reference', 120);
            $table->timestampTz('started_at');
            $table->timestampTz('expires_at');
            $table->timestampTz('ended_at')->nullable();
            $table->string('end_reason', 24)->nullable();
            $table->string('correlation_id', 64)->nullable();

            $table->index(['organization_id', 'started_at']);
        });
        DB::statement('ALTER TABLE support_sessions ADD CONSTRAINT support_sessions_max_30_minutes CHECK (expires_at > started_at AND expires_at <= started_at + interval \'30 minutes\')');
        DB::statement("ALTER TABLE support_sessions ADD CONSTRAINT support_sessions_end_reason CHECK (end_reason IS NULL OR end_reason IN ('exited', 'expired', 'admin_disabled', 'target_invalid'))");
        // One live support session per admin: concurrent starts cannot create an ambiguous context.
        DB::statement('CREATE UNIQUE INDEX support_sessions_one_active_per_admin ON support_sessions (platform_admin_id) WHERE ended_at IS NULL');

        Schema::create('plan_term_versions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('amount_centavos');
            $table->unsignedSmallInteger('trial_days');
            $table->unsignedSmallInteger('grace_days');
            // Versions are immutable and ordered: a term applies from this instant until the next version's.
            $table->timestampTz('effective_at')->unique();
            $table->foreignId('created_by_admin_id')->constrained('platform_admins')->restrictOnDelete();
            $table->string('reason', 500);
            $table->timestampTz('created_at');
        });
        DB::statement('ALTER TABLE plan_term_versions ADD CONSTRAINT plan_term_versions_positive CHECK (amount_centavos > 0 AND trial_days BETWEEN 1 AND 365 AND grace_days BETWEEN 1 AND 90)');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION plan_term_versions_immutable() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'plan_term_versions is immutable';
            END;
            $$ LANGUAGE plpgsql
        SQL);
        DB::unprepared('CREATE TRIGGER plan_term_versions_no_change BEFORE UPDATE OR DELETE ON plan_term_versions FOR EACH ROW EXECUTE FUNCTION plan_term_versions_immutable()');

        Schema::create('platform_job_retries', function (Blueprint $table): void {
            $table->id();
            $table->string('job_uuid', 64);
            $table->string('job_class', 160);
            $table->string('queue', 120);
            $table->foreignId('platform_admin_id')->constrained()->restrictOnDelete();
            $table->string('status', 20);
            $table->timestampTz('failed_at');
            $table->timestampTz('created_at');
            $table->timestampTz('settled_at')->nullable();
        });
        DB::statement("ALTER TABLE platform_job_retries ADD CONSTRAINT platform_job_retries_status CHECK (status IN ('claimed', 'queued', 'dispatch_failed'))");
        // At most one in-flight claim per failed job: concurrent operators produce a single winner.
        // A job that fails again after a retry keeps its uuid and can be claimed again.
        DB::statement("CREATE UNIQUE INDEX platform_job_retries_one_claim ON platform_job_retries (job_uuid) WHERE status = 'claimed'");
        DB::statement('CREATE INDEX platform_job_retries_recent ON platform_job_retries (created_at)');
    }

    public function down(): void
    {
        foreach (['platform_job_retries', 'plan_term_versions', 'support_sessions', 'platform_audit_events', 'platform_admin_recovery_codes', 'platform_admin_invitations', 'platform_password_reset_tokens', 'platform_admins'] as $table) {
            Schema::dropIfExists($table);
        }
        DB::unprepared('DROP FUNCTION IF EXISTS platform_audit_events_immutable() CASCADE');
        DB::unprepared('DROP FUNCTION IF EXISTS plan_term_versions_immutable() CASCADE');
    }
};
