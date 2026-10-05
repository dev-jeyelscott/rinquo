<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 63)->unique();
            $table->string('tagline', 160)->nullable();
            $table->text('description')->nullable();
            $table->string('brand_color', 7)->default('#1E40AF');
            // Set only by the explicit Publish action; cleared whenever the
            // organization stops being ready.
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')");
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_brand_color_format CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$')");

        Schema::create('branches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('address_line', 255)->nullable();
            $table->string('city', 120)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('timezone', 64)->default('Asia/Manila');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            // The MVP allows exactly one branch per organization.
            $table->unique('organization_id');
            $table->unique(['organization_id', 'id']);
        });

        DB::statement("ALTER TABLE branches ADD CONSTRAINT branches_timezone_mvp CHECK (timezone = 'Asia/Manila')");

        Schema::create('organization_memberships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('role', 16);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['organization_id', 'user_id']);
        });

        DB::statement("ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role CHECK (role IN ('owner', 'staff'))");
        // An Owner owns at most one organization in the MVP.
        DB::statement("CREATE UNIQUE INDEX organization_memberships_one_owner_org ON organization_memberships (user_id) WHERE role = 'owner'");

        Schema::create('organization_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->string('kind', 16);
            // Random private object key; never exposed to clients.
            $table->string('storage_key', 255)->unique();
            $table->string('mime_type', 64);
            $table->string('alt_text', 160);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();

            $table->index(['organization_id', 'kind']);
        });

        DB::statement("ALTER TABLE organization_media ADD CONSTRAINT organization_media_kind CHECK (kind IN ('logo', 'hero', 'gallery'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_media');
        Schema::dropIfExists('organization_memberships');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('organizations');
    }
};
