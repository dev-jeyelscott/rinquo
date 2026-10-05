<?php

namespace App\Modules\Tenancy\Http;

use App\Modules\Booking\Support\ConflictBoard;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Renders an Owner settings page with the props every tab shares: the
 * organization summary and the authoritative readiness checklist. Authorization
 * has already happened in the route's policy middleware.
 */
final class OwnerPage
{
    /** @param  array<string, mixed>  $props */
    public static function render(string $component, Organization $organization, array $props = []): Response
    {
        $readiness = app(ReadinessEvaluator::class)->evaluate($organization);

        return Inertia::render($component, [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'branchName' => $organization->branch?->name,
                'publishedAt' => $organization->published_at?->toIso8601String(),
                'shopUrl' => route('shops.show', $organization->slug),
                'operationsUrl' => route('owner.operations.index', $organization, absolute: false),
                'conflictsUrl' => route('owner.scheduling-conflicts.index', $organization, absolute: false),
                'unresolvedConflicts' => ConflictBoard::unresolvedCount($organization),
                'bookingRequestsUrl' => route('owner.booking-requests.index', $organization, absolute: false),
                'baseUrl' => Str::beforeLast(route('owner.settings.profile', $organization, absolute: false), '/profile'),
            ],
            'readiness' => [
                'isReady' => $readiness->isReady(),
                'items' => $readiness->items,
            ],
            ...$props,
        ]);
    }
}
