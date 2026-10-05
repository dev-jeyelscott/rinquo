<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Http\Storefront;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Public, unauthenticated storefront. Draft, unknown and no-longer-ready shops
 * all render the same generic unavailable page (404) so nothing about a tenant
 * leaks and slugs cannot be enumerated.
 */
class PublicShopController extends Controller
{
    public function show(Request $request, string $slug, Storefront $storefront): Response
    {
        $organization = $storefront->visibleOrganization($slug);

        if ($organization === null) {
            return Inertia::render('shops/unavailable')->toResponse($request)->setStatusCode(404);
        }

        return Inertia::render('shops/show', $storefront->payload($organization))->toResponse($request);
    }

    public function media(string $slug, int $media, Storefront $storefront): Response
    {
        $organization = $storefront->visibleOrganization($slug);
        abort_if($organization === null, 404);

        $item = OrganizationMedia::query()
            ->where('organization_id', $organization->id)
            ->whereKey($media)
            ->active()
            ->first();
        abort_if($item === null, 404);

        return MediaResponse::for($item);
    }
}
