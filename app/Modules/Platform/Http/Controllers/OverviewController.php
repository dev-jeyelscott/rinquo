<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use App\Modules\Subscription\Support\PlanTerms;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    public function __invoke(): Response
    {
        /** @var PlatformAdmin $admin */
        $admin = Auth::guard('platform')->user();
        $terms = PlanTerms::current();
        $live = SupportSession::query()->where('platform_admin_id', $admin->id)->whereNull('ended_at')->where('expires_at', '>', now())->first();

        return Inertia::render('platform/overview', [
            // Failures first: the operational signal that needs a person ranks above quiet summaries.
            'failedJobs' => DB::table('failed_jobs')->count(),
            'activeAdmins' => PlatformAdmin::query()->where('status', PlatformAdmin::ACTIVE)->count(),
            'plan' => ['amountCentavos' => $terms->amountCentavos, 'trialDays' => $terms->trialDays, 'graceDays' => $terms->graceDays],
            'liveSupportSession' => $live === null ? null : [
                'id' => $live->id,
                'organizationName' => $live->organization->name,
                'expiresAt' => $live->expires_at->toIso8601String(),
                'url' => route('platform.support.overview', $live->id, absolute: false),
            ],
        ]);
    }
}
