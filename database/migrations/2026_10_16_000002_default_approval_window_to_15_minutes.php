<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Decision 214: the staff-approval response window defaults to 15 minutes.
 * The table default changes for new organizations. A stored 120 is moved to 15
 * only when the Owner never edited the policy (no booking_policy.updated audit
 * event); edited and other values are deliberate and stay. Pending bookings keep
 * their stored pending_expires_at. The 15..1440 CHECK is unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE booking_policies ALTER COLUMN approval_window_minutes SET DEFAULT 15');

        DB::statement(<<<'SQL'
            UPDATE booking_policies
            SET approval_window_minutes = 15, updated_at = now()
            WHERE approval_window_minutes = 120
              AND NOT EXISTS (
                  SELECT 1 FROM organization_audit_events e
                  WHERE e.organization_id = booking_policies.organization_id
                    AND e.action = 'booking_policy.updated'
              )
            SQL);
    }

    public function down(): void
    {
        // Only the default is restored; migrated values are not reversed.
        DB::statement('ALTER TABLE booking_policies ALTER COLUMN approval_window_minutes SET DEFAULT 120');
    }
};
