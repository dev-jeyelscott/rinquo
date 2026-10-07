<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\EndSupportSession;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

/** Ending is the one write allowed under /platform/support, and it only closes the support session itself. */
class SupportExitController extends Controller
{
    public function __invoke(string $supportSession, EndSupportSession $end): RedirectResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = Auth::guard(PlatformSession::GUARD)->user();
        $session = SupportSession::query()->where('platform_admin_id', $admin->id)->findOrFail($supportSession);
        $end->handle($session, 'exited', $admin);

        return to_route('platform.organizations.show', $session->organization_id)->with('status', 'Support session ended. No tenant data was changed.');
    }
}
