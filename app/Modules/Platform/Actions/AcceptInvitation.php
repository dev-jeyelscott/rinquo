<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\AdminInvitation;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AcceptInvitation
{
    /** Whether an unused, unexpired, unrevoked invitation exists for this token. */
    public function isUsable(string $token): bool
    {
        return AdminInvitation::query()->where('token_digest', AdminInvitation::digest($token))
            ->whereNull('consumed_at')->whereNull('revoked_at')->where('expires_at', '>', CarbonImmutable::now())->exists();
    }

    public function handle(string $token, string $name, string $password): PlatformAdmin
    {
        return DB::transaction(function () use ($token, $name, $password): PlatformAdmin {
            $invitation = AdminInvitation::query()->where('token_digest', AdminInvitation::digest($token))->lockForUpdate()->first();

            if ($invitation === null || $invitation->consumed_at !== null || $invitation->revoked_at !== null || $invitation->expires_at <= CarbonImmutable::now()
                || PlatformAdmin::query()->where('email', $invitation->email)->exists()) {
                throw ValidationException::withMessages(['token' => 'This invitation is invalid, expired or already used.']);
            }

            $invitation->forceFill(['consumed_at' => CarbonImmutable::now()])->save();
            $admin = PlatformAdmin::query()->create(['email' => $invitation->email, 'name' => $name, 'password' => $password]);
            $admin->forceFill(['password_changed_at' => CarbonImmutable::now(), 'created_by_admin_id' => $invitation->invited_by_admin_id])->save();
            PlatformAudit::record('admin.invitation_accepted', 'success', $admin, 'invitation', $invitation->id, ['invitation_id' => $invitation->id]);

            return $admin;
        });
    }
}
