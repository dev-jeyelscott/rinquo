<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Opens a read-only support session for one active Owner/Staff member of one organization.
 * Customers are never targets: the target is resolved only through an active membership.
 */
final class StartSupportSession
{
    public function handle(PlatformAdmin $admin, Organization $organization, int $targetUserId, string $reason, string $reference): SupportSession
    {
        try {
            return DB::transaction(function () use ($admin, $organization, $targetUserId, $reason, $reference): SupportSession {
                $now = CarbonImmutable::now();

                // A lapsed session of this admin is closed first so the one-live-session index only blocks a real one.
                SupportSession::query()->where('platform_admin_id', $admin->id)->whereNull('ended_at')->where('expires_at', '<=', $now)
                    ->update(['ended_at' => $now, 'end_reason' => 'expired']);

                $isMember = Membership::query()->where('organization_id', $organization->id)->where('user_id', $targetUserId)->where('is_active', true)->exists();
                if (! $isMember) {
                    throw ValidationException::withMessages(['target_user_id' => 'Choose an active owner or staff member of this organization.']);
                }

                $requestId = Context::get('request_id');
                $session = SupportSession::query()->create([
                    'platform_admin_id' => $admin->id,
                    'organization_id' => $organization->id,
                    'target_user_id' => $targetUserId,
                    'reason' => $reason,
                    'reference' => $reference,
                    'started_at' => $now,
                    'expires_at' => $now->addMinutes(min(30, (int) config('rinquo.platform.support_minutes'))),
                    'correlation_id' => is_string($requestId) ? $requestId : null,
                ]);

                PlatformAudit::record('support.started', 'success', $admin, 'support_session', $session->id, [
                    'organization_id' => $organization->id, 'target_user_id' => $targetUserId, 'support_session_id' => $session->id, 'reference' => $reference,
                ]);

                return $session;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['target_user_id' => 'End your current support session before starting another.']);
        }
    }
}
