<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Actions\UpdateDirectoryPreference;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

class DirectoryPreferenceController extends Controller
{
    public function show(Organization $organization): Response
    {
        return OwnerPage::render('owner/settings/directory', $organization, ['directoryOptedIn' => $organization->directory_opted_in]);
    }

    public function update(Request $request, Organization $organization, UpdateDirectoryPreference $action): RedirectResponse
    {
        $optedIn = (bool) $request->validate(['directory_opted_in' => ['required', 'boolean']])['directory_opted_in'];
        $action->handle($organization, $request->user(), $optedIn);

        return to_route('owner.settings.directory', $organization)->with('status', $optedIn ? 'Your ready, published shop can now appear in the Rinquo directory.' : 'Your shop was removed from the Rinquo directory. Direct shop links still work while public.');
    }
}
