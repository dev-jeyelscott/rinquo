<?php

namespace App\Modules\Tenancy\Http;

use App\Modules\Booking\Support\ConflictBoard;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Subscription\Support\BillingPresenter;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Renders an Owner settings page with the props every tab shares: the
 * organization summary, the authoritative readiness checklist and the viewer's
 * role (so Staff are never shown Owner-only destinations). Authorization
 * has already happened in the route's policy middleware.
 */
final class OwnerPage
{
    /** @param  array<string, mixed>  $props */
    public static function render(string $component, Organization $organization, array $props = []): Response
    {
        $readiness = app(ReadinessEvaluator::class)->evaluate($organization);
        // Presentation only: the destinations a role may see. Policies still authorize every request.
        $isOwner = Membership::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', auth()->id())
            ->where('is_active', true)
            ->where('role', Membership::OWNER)
            ->exists();

        return Inertia::render($component, [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'branchName' => $organization->branch?->name,
                'publishedAt' => $organization->published_at?->toIso8601String(),
                'directoryOptedIn' => $organization->directory_opted_in,
                'shopUrl' => route('shops.show', $organization->slug),
                'operationsUrl' => route('owner.operations.index', $organization, absolute: false),
                'conflictsUrl' => route('owner.scheduling-conflicts.index', $organization, absolute: false),
                'unresolvedConflicts' => ConflictBoard::unresolvedCount($organization),
                'bookingRequestsUrl' => route('owner.booking-requests.index', $organization, absolute: false),
                'baseUrl' => route('owner.settings.index', $organization, absolute: false),
                'billingUrl' => route('owner.settings.billing', $organization, absolute: false),
            ],
            'viewer' => ['role' => $isOwner ? Membership::OWNER : Membership::STAFF, 'canManageOwnerAreas' => $isOwner],
            'entitlement' => app(BillingPresenter::class)->summary($organization),
            'readiness' => [
                'isReady' => $readiness->isReady(),
                'items' => $readiness->items,
            ],
            ...$props,
        ]);
    }
}
