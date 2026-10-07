<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\ChangeAdminAccess;
use App\Modules\Platform\Actions\InviteAdmin;
use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Http\Requests\InviteAdminRequest;
use App\Modules\Platform\Http\Requests\StepUpOnlyRequest;
use App\Modules\Platform\Models\AdminInvitation;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AdminsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('platform/admins', [
            'admins' => PlatformAdmin::query()->orderBy('email')->limit(100)->get()->map(fn (PlatformAdmin $a): array => [
                'id' => $a->id,
                'name' => $a->name,
                'email' => $a->email,
                'status' => $a->status,
                'factorEnrolled' => $a->hasConfirmedFactor(),
                'lastLoginAt' => $a->last_login_at?->toIso8601String(),
            ])->all(),
            'invitations' => AdminInvitation::query()->whereNull('consumed_at')->whereNull('revoked_at')->where('expires_at', '>', CarbonImmutable::now())
                ->orderBy('expires_at')->limit(100)->get()->map(fn (AdminInvitation $i): array => [
                    'id' => $i->id, 'email' => $i->email, 'expiresAt' => $i->expires_at->toIso8601String(),
                ])->all(),
        ]);
    }

    public function invite(InviteAdminRequest $request, InviteAdmin $invite): RedirectResponse
    {
        $invite->handle($request->admin(), $request->string('email')->toString());

        return back()->with('status', 'Invitation sent to '.PlatformAdmin::normalizeEmail($request->string('email')->toString()).'. It can be used once.');
    }

    public function revokeInvitation(StepUpOnlyRequest $request, AdminInvitation $invitation): RedirectResponse
    {
        AdminInvitation::query()->whereKey($invitation->id)->whereNull('consumed_at')->whereNull('revoked_at')->update(['revoked_at' => CarbonImmutable::now()]);
        PlatformAudit::record('admin.invitation_revoked', 'success', $request->admin(), 'invitation', $invitation->id, ['invitation_id' => $invitation->id]);

        return back()->with('status', 'Invitation revoked.');
    }

    public function disable(StepUpOnlyRequest $request, PlatformAdmin $admin, ChangeAdminAccess $access): RedirectResponse
    {
        $access->disable($request->admin(), $admin);

        return back()->with('status', $admin->email.' was disabled and signed out everywhere.');
    }

    public function enable(StepUpOnlyRequest $request, PlatformAdmin $admin, ChangeAdminAccess $access): RedirectResponse
    {
        $access->enable($request->admin(), $admin);

        return back()->with('status', $admin->email.' was re-enabled. They must enroll a new second factor at next sign-in.');
    }

    public function resetFactor(StepUpOnlyRequest $request, PlatformAdmin $admin, ChangeAdminAccess $access): RedirectResponse
    {
        $access->resetFactor($request->admin(), $admin);

        return back()->with('status', 'The second factor for '.$admin->email.' was reset. They must enroll a new one at next sign-in.');
    }
}
