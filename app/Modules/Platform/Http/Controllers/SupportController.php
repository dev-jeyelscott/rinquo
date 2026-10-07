<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Models\Booking;
use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Support\SupportContext;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The allowlisted, read-only tenant views. Each one applies the target member's own policy
 * and reads only inside the session's organization. Nothing here can write.
 */
class SupportController extends Controller
{
    public function __construct(private readonly SupportContext $context) {}

    public function overview(AccessResolver $access, ReadinessEvaluator $readiness): Response
    {
        $organization = $this->context->organization;
        $this->context->gate()->authorize('operate', $organization);
        $isOwner = $this->context->gate()->allows('manage', $organization);
        $resolved = $access->for($organization);

        return Inertia::render('platform/support/overview', [
            'organization' => ['name' => $organization->name, 'slug' => $organization->slug, 'tagline' => $organization->tagline, 'published' => $organization->isPublished()],
            // Owner-only detail is shown only when the target member's own policy would show it.
            'ownerDetail' => ! $isOwner ? null : [
                'entitlement' => $resolved->entitlement,
                'closed' => $resolved->isClosed(),
                'trialEndsAt' => $resolved->trialEndsAt?->toIso8601String(),
                'paidUntil' => $resolved->paidUntil?->toIso8601String(),
                'graceEndsAt' => $resolved->graceEndsAt?->toIso8601String(),
                'readiness' => array_map(fn (array $i): array => ['label' => $i['label'], 'passed' => $i['passed'], 'detail' => $i['detail']], $readiness->evaluate($organization)->items),
            ],
            'members' => Membership::query()->where('organization_id', $organization->id)->where('is_active', true)->with('user:id,email')->orderBy('role')->orderBy('id')->limit(50)->get()
                ->map(fn (Membership $m): array => ['email' => $m->user->email, 'role' => $m->role])->all(),
            'bookingRequestsUrl' => route('platform.support.booking-requests', $this->context->session->id, absolute: false),
        ]);
    }

    /** Pending requests without customer contact details, notes or plates. */
    public function bookingRequests(): Response
    {
        $organization = $this->context->organization;
        $this->context->gate()->authorize('operate', $organization);

        $page = Booking::query()
            ->where('organization_id', $organization->id)
            ->where('status', Booking::PENDING_APPROVAL)
            ->where('pending_expires_at', '>', CarbonImmutable::now())
            ->orderBy('pending_expires_at')->orderBy('id')
            ->simplePaginate(20);

        return Inertia::render('platform/support/booking-requests', [
            'requests' => $page->getCollection()->map(fn (Booking $b): array => [
                'id' => $b->public_id,
                'serviceName' => $b->service_name,
                'vehicleName' => $b->vehicle_type_name,
                'startAt' => $b->scheduled_start_at->utc()->toIso8601String(),
                'pendingExpiresAt' => $b->pending_expires_at?->utc()->toIso8601String(),
            ])->values()->all(),
            'pagination' => ['previousUrl' => $page->previousPageUrl(), 'nextUrl' => $page->nextPageUrl()],
            'overviewUrl' => route('platform.support.overview', $this->context->session->id, absolute: false),
        ]);
    }

    /** Anything else under /platform/support that is not on the allowlist. Audited, then refused. */
    public function notAllowlisted(): never
    {
        PlatformAudit::record('support.attempt', 'blocked', $this->context->admin, 'support_session', $this->context->session->id, [
            'organization_id' => $this->context->organization->id, 'support_session_id' => $this->context->session->id, 'reason_code' => 'not_allowlisted',
        ]);
        abort(404);
    }
}
