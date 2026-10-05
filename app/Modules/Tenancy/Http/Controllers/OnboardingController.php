<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Actions\CreateOrganization;
use App\Modules\Tenancy\Http\Requests\OnboardingRequest;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if (Membership::query()->where('user_id', $request->user()->id)->where('role', Membership::OWNER)->exists()) {
            return to_route('owner.home');
        }

        return Inertia::render('owner/onboarding', [
            'suggestedBranchName' => 'Main branch',
            'timezone' => 'Asia/Manila',
        ]);
    }

    public function store(OnboardingRequest $request, CreateOrganization $action): RedirectResponse
    {
        $organization = $action->handle(
            $request->user(),
            $request->string('name')->toString(),
            $request->string('slug')->toString(),
            $request->string('branch_name')->toString(),
        );

        return to_route('owner.settings.profile', $organization)->with('status', 'Your organization was created. Complete the checklist to publish.');
    }
}
