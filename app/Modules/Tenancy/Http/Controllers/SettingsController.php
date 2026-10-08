<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Inertia\Response;

/** The Owner Settings index. Authorization is the route's `can:manage` policy. */
class SettingsController extends Controller
{
    public function __invoke(Organization $organization): Response
    {
        return OwnerPage::render('owner/settings/index', $organization);
    }
}
