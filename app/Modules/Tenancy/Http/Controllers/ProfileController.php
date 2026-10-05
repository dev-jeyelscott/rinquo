<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Actions\ArchiveMedia;
use App\Modules\Tenancy\Actions\StoreMedia;
use App\Modules\Tenancy\Actions\UpdateProfile;
use App\Modules\Tenancy\Http\OwnerPage;
use App\Modules\Tenancy\Http\Requests\UpdateProfileRequest;
use App\Modules\Tenancy\Http\Requests\UploadMediaRequest;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProfileController extends Controller
{
    public function show(Organization $organization): Response
    {
        $branch = $organization->branch()->firstOrFail();

        return OwnerPage::render('owner/settings/profile', $organization, [
            'profile' => [
                'name' => $organization->name,
                'slug' => $organization->slug,
                'tagline' => (string) $organization->tagline,
                'description' => (string) $organization->description,
                'brandColor' => $organization->brand_color,
            ],
            'branch' => [
                'name' => $branch->name,
                'addressLine' => (string) $branch->address_line,
                'city' => (string) $branch->city,
                'phone' => (string) $branch->phone,
                'timezone' => $branch->timezone,
            ],
            'media' => $organization->media()->active()->orderBy('kind')->orderBy('sort_order')->get()
                ->map(fn (OrganizationMedia $media): array => [
                    'id' => $media->id,
                    'kind' => $media->kind,
                    'altText' => $media->alt_text,
                    'url' => route('owner.settings.media.show', [$organization, $media], absolute: false),
                ])->all(),
            'galleryLimit' => StoreMedia::GALLERY_LIMIT,
        ]);
    }

    public function update(UpdateProfileRequest $request, Organization $organization, UpdateProfile $action): RedirectResponse
    {
        $action->handle(
            $organization,
            $request->user(),
            [
                'name' => $request->string('name')->toString(),
                'tagline' => $request->string('tagline')->toString(),
                'description' => $request->string('description')->toString(),
                'brand_color' => $request->string('brand_color')->toString(),
            ],
            [
                'name' => $request->string('branch_name')->toString(),
                'address_line' => $request->string('address_line')->toString(),
                'city' => $request->string('city')->toString(),
                'phone' => $request->filled('phone') ? $request->string('phone')->toString() : null,
            ],
        );

        return back()->with('status', 'Profile saved.');
    }

    public function storeMedia(UploadMediaRequest $request, Organization $organization, StoreMedia $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $request->file('file'), $request->string('kind')->toString(), $request->string('alt_text')->toString());

        return back()->with('status', 'Photo saved.');
    }

    public function archiveMedia(Request $request, Organization $organization, OrganizationMedia $media, ArchiveMedia $action): RedirectResponse
    {
        $action->handle($organization, $request->user(), $media);

        return back()->with('status', 'Photo removed.');
    }

    /** Owner preview of draft media, authorized by the policy middleware. */
    public function showMedia(Organization $organization, OrganizationMedia $media): StreamedResponse
    {
        abort_if($media->archived_at !== null, 404);

        return MediaResponse::for($media);
    }
}
