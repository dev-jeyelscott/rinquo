<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Mail\SecurityNoticeMail;
use App\Modules\Platform\Models\AdminInvitation;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/** Disable, re-enable and factor reset: each atomically revokes every credential and session of the target. */
final class ChangeAdminAccess
{
    public function disable(PlatformAdmin $actor, PlatformAdmin $target): void
    {
        if ($actor->is($target)) {
            throw ValidationException::withMessages(['admin' => 'You cannot disable your own account.']);
        }

        DB::transaction(function () use ($actor, $target): void {
            $locked = PlatformAdmin::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->revokeEverything($locked);
            $locked->forceFill(['status' => PlatformAdmin::DISABLED, 'disabled_at' => CarbonImmutable::now()])->save();

            // Pending invitations issued by, or addressed to, a disabled admin are no longer trustworthy.
            AdminInvitation::query()->whereNull('consumed_at')->whereNull('revoked_at')
                ->where(fn ($q) => $q->where('invited_by_admin_id', $locked->id)->orWhere('email', $locked->email))
                ->update(['revoked_at' => CarbonImmutable::now()]);

            PlatformAudit::record('admin.disabled', 'success', $actor, 'platform_admin', $locked->id, ['target_admin_id' => $locked->id]);
        });
    }

    /** Re-enabling restores no factor: the admin must enroll a new one at the next sign-in. */
    public function enable(PlatformAdmin $actor, PlatformAdmin $target): void
    {
        DB::transaction(function () use ($actor, $target): void {
            $locked = PlatformAdmin::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->revokeEverything($locked);
            $locked->forceFill(['status' => PlatformAdmin::ACTIVE, 'disabled_at' => null])->save();
            PlatformAudit::record('admin.enabled', 'success', $actor, 'platform_admin', $locked->id, ['target_admin_id' => $locked->id]);
        });
    }

    /** Clears the factor and sessions so the target must sign in with the password and enroll a new factor. */
    public function resetFactor(PlatformAdmin $actor, PlatformAdmin $target): void
    {
        DB::transaction(function () use ($actor, $target): void {
            $locked = PlatformAdmin::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->revokeEverything($locked);
            PlatformAudit::record('admin.factor_reset', 'success', $actor, 'platform_admin', $locked->id, ['target_admin_id' => $locked->id]);
        });

        Mail::to($target->email)->send(new SecurityNoticeMail('The second factor and recovery codes on your platform account were reset.'));
    }

    private function revokeEverything(PlatformAdmin $admin): void
    {
        $admin->recoveryCodes()->delete();
        SupportSession::query()->where('platform_admin_id', $admin->id)->whereNull('ended_at')
            ->update(['ended_at' => CarbonImmutable::now(), 'end_reason' => 'admin_disabled']);
        $admin->forceFill([
            'totp_secret' => null,
            'totp_confirmed_at' => null,
            'totp_last_step' => 0,
            'session_generation' => $admin->session_generation + 1,
        ])->save();
    }
}
