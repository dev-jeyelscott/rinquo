<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Actions\PublishOrganization;
use App\Modules\Tenancy\Actions\UnpublishOrganization;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

class PublicationController extends Controller
{
    public function show(Organization $organization, ReadinessEvaluator $readiness): Response
    {
        return OwnerPage::render('owner/settings/readiness', $organization, [
            'variants' => $readiness->evaluate($organization)->variants,
            'branchTimezone' => 'Asia/Manila',
        ]);
    }

    public function publish(Request $request, Organization $organization, PublishOrganization $action): RedirectResponse
    {
        $action->handle($organization, $request->user());

        return back()->with('status', 'Your shop is published.');
    }

    public function unpublish(Request $request, Organization $organization, UnpublishOrganization $action): RedirectResponse
    {
        $action->handle($organization, $request->user());

        return back()->with('status', 'Your shop is unpublished.');
    }
}
