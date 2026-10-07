<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Mail\InvitationMail;
use App\Modules\Platform\Models\AdminInvitation;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class InviteAdmin
{
    public function handle(PlatformAdmin $actor, string $email): void
    {
        $email = PlatformAdmin::normalizeEmail($email);
        $hours = (int) config('rinquo.platform.invitation_hours');
        $token = Str::random(48);

        DB::transaction(function () use ($actor, $email, $token, $hours): void {
            if (PlatformAdmin::query()->where('email', $email)->exists()) {
                throw ValidationException::withMessages(['email' => 'An administrator with this email already exists.']);
            }
            // A new invitation supersedes any earlier pending one for the same address.
            AdminInvitation::query()->where('email', $email)->whereNull('consumed_at')->whereNull('revoked_at')
                ->update(['revoked_at' => CarbonImmutable::now()]);

            $invitation = AdminInvitation::query()->create([
                'email' => $email,
                'token_digest' => AdminInvitation::digest($token),
                'invited_by_admin_id' => $actor->id,
                'expires_at' => CarbonImmutable::now()->addHours($hours),
            ]);
            PlatformAudit::record('admin.invited', 'success', $actor, 'invitation', $invitation->id, ['invitation_id' => $invitation->id]);
        });

        // Mailed after commit and not queued: the token never sits in a queue payload.
        Mail::to($email)->send(new InvitationMail(route('platform.invitation.show', ['token' => $token]), $hours));
    }
}
