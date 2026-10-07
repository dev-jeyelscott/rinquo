<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\StartSupportSession;
use App\Modules\Platform\Http\Requests\StartSupportRequest;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Organization search for support. Read-only; starting a support session is the only action. */
class OrganizationsController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request, AccessResolver $access): Response
    {
        $search = trim((string) $request->query('search', ''));
        $search = mb_substr($search, 0, 80);

        $page = Organization::query()
            ->when($search !== '', function ($query) use ($search): void {
                // Escape LIKE wildcards so the term is matched literally.
                $term = '%'.addcslashes($search, '\\%_').'%';
                $query->where(fn ($q) => $q->where('name', 'ilike', $term)->orWhere('slug', 'ilike', $term));
            })
            ->orderBy('name')->orderBy('id')
            ->simplePaginate(self::PER_PAGE)->withQueryString();

        return Inertia::render('platform/organizations/index', [
            'search' => $search,
            'organizations' => $page->getCollection()->map(fn (Organization $o): array => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'published' => $o->isPublished(),
                'entitlement' => $access->for($o)->entitlement,
                'closed' => $access->for($o)->isClosed(),
                'url' => route('platform.organizations.show', $o->id, absolute: false),
            ])->values()->all(),
            'pagination' => ['previousUrl' => $page->previousPageUrl(), 'nextUrl' => $page->nextPageUrl()],
        ]);
    }

    public function show(Organization $organization, AccessResolver $access): Response
    {
        $resolved = $access->for($organization);

        return Inertia::render('platform/organizations/show', [
            'organization' => ['id' => $organization->id, 'name' => $organization->name, 'slug' => $organization->slug, 'published' => $organization->isPublished()],
            'entitlement' => ['state' => $resolved->entitlement, 'closed' => $resolved->isClosed()],
            // Active Owner and Staff only. Customers are never offered as support targets.
            'members' => Membership::query()->where('organization_id', $organization->id)->where('is_active', true)->with('user:id,email')
                ->orderBy('role')->orderBy('id')->limit(50)->get()->map(fn (Membership $m): array => [
                    'userId' => $m->user_id, 'email' => $m->user->email, 'role' => $m->role,
                ])->all(),
            'startUrl' => route('platform.organizations.support.start', $organization->id, absolute: false),
        ]);
    }

    public function startSupport(StartSupportRequest $request, Organization $organization, StartSupportSession $start): RedirectResponse
    {
        $session = $start->handle(
            $request->admin(),
            $organization,
            (int) $request->input('target_user_id'),
            $request->string('reason')->toString(),
            $request->string('reference')->toString(),
        );

        return to_route('platform.support.overview', $session->id);
    }
}
