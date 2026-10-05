<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Resumes the signed-in Owner at their organization, or at onboarding. */
class OwnerHomeController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $membership = Membership::query()
            ->where('user_id', $request->user()->id)
            ->where('role', Membership::OWNER)
            ->where('is_active', true)
            ->first();

        return $membership === null
            ? to_route('owner.onboarding')
            : to_route('owner.settings.profile', $membership->organization_id);
    }
}
