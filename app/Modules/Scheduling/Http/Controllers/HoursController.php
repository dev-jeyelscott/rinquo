<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Scheduling\Actions\ReplaceBranchHours;
use App\Modules\Scheduling\Http\Requests\HoursRequest;
use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Inertia\Response;

class HoursController extends Controller
{
    public function show(Organization $organization): Response
    {
        return OwnerPage::render('owner/settings/hours', $organization, [
            'weekly' => BranchWeeklyHour::query()->where('organization_id', $organization->id)->orderBy('weekday')->orderBy('opens_at')->get()
                ->map(fn (BranchWeeklyHour $row): array => [
                    'weekday' => $row->weekday,
                    'opensAt' => substr($row->opens_at, 0, 5),
                    'closesAt' => substr($row->closes_at, 0, 5),
                ])->all(),
            'overrides' => BranchDateOverride::query()->where('organization_id', $organization->id)->orderBy('local_date')->get()
                ->map(fn (BranchDateOverride $row): array => [
                    'localDate' => $row->local_date->toDateString(),
                    'isClosed' => $row->is_closed,
                    'opensAt' => $row->opens_at === null ? null : substr($row->opens_at, 0, 5),
                    'closesAt' => $row->closes_at === null ? null : substr($row->closes_at, 0, 5),
                ])->all(),
            'branchTimezone' => 'Asia/Manila',
        ]);
    }

    public function update(HoursRequest $request, Organization $organization, ReplaceBranchHours $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $request->weekly(), $request->overrides());

        return back()->with('status', 'Business hours saved.');
    }
}
