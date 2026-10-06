<?php

namespace App\Modules\Subscription\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Subscription\Actions\OpenRenewalRequest;
use App\Modules\Subscription\Support\BillingPresenter;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Owner billing (the route's can:manage policy). The server chooses the amount
 * and every date; the browser can only ask for a renewal QR.
 */
class BillingController extends Controller
{
    public function show(Organization $organization, BillingPresenter $presenter): Response
    {
        return OwnerPage::render('owner/settings/billing', $organization, [
            'billing' => $presenter->billing($organization),
            'urls' => [
                'renewal' => route('owner.settings.billing.renewal', $organization, absolute: false),
                'billing' => route('owner.settings.billing', $organization, absolute: false),
                'closure' => route('owner.settings.closure.store', $organization, absolute: false),
                'recover' => route('owner.settings.closure.recover', $organization, absolute: false),
            ],
        ]);
    }

    public function renew(Request $request, Organization $organization, OpenRenewalRequest $open): RedirectResponse
    {
        $open->handle($organization, $request->user(), $request->boolean('refresh'));

        return to_route('owner.settings.billing', $organization);
    }
}
