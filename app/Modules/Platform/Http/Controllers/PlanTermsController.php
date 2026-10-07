<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\PublishPlanTerms;
use App\Modules\Platform\Http\Requests\PublishPlanTermsRequest;
use App\Modules\Platform\Models\PlanTermVersion;
use App\Modules\Subscription\Support\PlanTerms;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class PlanTermsController extends Controller
{
    public function show(): Response
    {
        $now = CarbonImmutable::now();
        $current = PlanTerms::current();

        return Inertia::render('platform/plan-terms', [
            'current' => ['amountCentavos' => $current->amountCentavos, 'trialDays' => $current->trialDays, 'graceDays' => $current->graceDays],
            'history' => PlanTermVersion::query()->orderByDesc('effective_at')->limit(50)->get()->map(fn (PlanTermVersion $v): array => [
                'id' => $v->id, 'amountCentavos' => $v->amount_centavos, 'trialDays' => $v->trial_days, 'graceDays' => $v->grace_days,
                'effectiveAt' => $v->effective_at->toIso8601String(), 'reason' => $v->reason, 'inForce' => $v->effective_at <= $now,
            ])->all(),
            'now' => $now->toIso8601String(),
        ]);
    }

    public function publish(PublishPlanTermsRequest $request, PublishPlanTerms $publish): RedirectResponse
    {
        $publish->handle(
            $request->admin(),
            (int) $request->input('amount_centavos'),
            (int) $request->input('trial_days'),
            (int) $request->input('grace_days'),
            CarbonImmutable::parse($request->string('effective_at')->toString()),
            $request->string('reason')->toString(),
        );

        return to_route('platform.plan-terms')->with('status', 'New plan terms published. They apply to new renewal requests and trials from the effective time; issued requests and paid periods are unchanged.');
    }
}
