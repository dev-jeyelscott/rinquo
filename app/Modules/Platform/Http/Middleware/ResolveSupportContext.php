<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Platform\Actions\EndSupportSession;
use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use App\Modules\Platform\Support\SupportContext;
use App\Modules\Tenancy\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards every /platform/support request, before any controller runs:
 *  - the session must belong to the signed-in admin, be live, and still target an active member;
 *  - only GET and HEAD continue: every other method is refused and audited as a blocked attempt;
 *  - every permitted view is audited before the response is built.
 */
final class ResolveSupportContext
{
    public function __construct(private readonly EndSupportSession $end) {}

    public function handle(Request $request, Closure $next): Response
    {
        $admin = Auth::guard(PlatformSession::GUARD)->user();
        $id = (string) $request->route('supportSession');
        $session = SupportSession::query()->find($id);

        if (! $admin instanceof PlatformAdmin || $session === null || $session->platform_admin_id !== $admin->id) {
            PlatformAudit::record('support.access', 'denied', $admin instanceof PlatformAdmin ? $admin : null, null, null, ['reason_code' => 'unknown_session']);
            abort(404);
        }

        $meta = ['organization_id' => $session->organization_id, 'support_session_id' => $session->id, 'method' => $request->getMethod(), 'path_template' => $this->template($request)];

        if ($session->ended_at !== null || $session->expires_at <= now()) {
            if ($session->ended_at === null) {
                $this->end->handle($session, 'expired', $admin);
            }
            PlatformAudit::record('support.access', 'denied', $admin, 'support_session', $session->id, [...$meta, 'reason_code' => 'not_live']);

            return $request->isMethodSafe()
                ? redirect()->route('platform.organizations.show', $session->organization_id)->with('status', 'The support session has ended. Start a new one to continue.')
                : abort(403);
        }

        $membership = SupportContext::membershipOf($session);
        $target = $membership === null ? null : User::query()->find($session->target_user_id);
        $organization = Organization::query()->find($session->organization_id);
        if ($membership === null || $target === null || $organization === null) {
            $this->end->handle($session, 'target_invalid', $admin);
            PlatformAudit::record('support.access', 'denied', $admin, 'support_session', $session->id, [...$meta, 'reason_code' => 'target_invalid']);
            abort(403);
        }

        if (! $request->isMethodSafe()) {
            PlatformAudit::record('support.attempt', 'blocked', $admin, 'support_session', $session->id, [...$meta, 'reason_code' => 'read_only']);
            abort(403, 'Support access is read-only.');
        }

        // The catch-all route audits its own blocked attempt; recording a view here would overstate what was seen.
        if ($request->route()?->getName() !== 'platform.support.blocked') {
            PlatformAudit::record('support.view', 'allowed', $admin, 'support_session', $session->id, $meta);
        }
        app()->instance(SupportContext::class, new SupportContext($session, $admin, $target, $organization, $membership->role));

        return $next($request);
    }

    /** The route's URI template (no ids or query values) so the audit row never carries request content. */
    private function template(Request $request): string
    {
        return mb_substr((string) $request->route()?->uri(), 0, 120);
    }
}
