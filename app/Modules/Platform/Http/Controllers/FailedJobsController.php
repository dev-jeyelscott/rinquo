<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\RetryFailedJob;
use App\Modules\Platform\Http\Requests\StepUpOnlyRequest;
use App\Modules\Platform\Models\JobRetry;
use App\Modules\Platform\Support\FailedJobs;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class FailedJobsController extends Controller
{
    public function index(FailedJobs $failedJobs): Response
    {
        $page = $failedJobs->page();

        return Inertia::render('platform/failed-jobs', [
            'jobs' => $page->items(),
            'total' => $page->total(),
            'pagination' => ['previousUrl' => $page->previousPageUrl(), 'nextUrl' => $page->nextPageUrl()],
            'recentRetries' => JobRetry::query()->orderByDesc('id')->limit(10)->get()->map(fn (JobRetry $r): array => [
                'jobUuid' => $r->job_uuid, 'jobClass' => $r->job_class, 'status' => $r->status, 'at' => $r->created_at->toIso8601String(),
            ])->all(),
        ]);
    }

    public function retry(StepUpOnlyRequest $request, string $job, RetryFailedJob $retry): RedirectResponse
    {
        $retry->handle($request->admin(), $job);

        return back()->with('status', 'The job was returned to its queue. It runs again once; the original failure remains in the retry record.');
    }
}
