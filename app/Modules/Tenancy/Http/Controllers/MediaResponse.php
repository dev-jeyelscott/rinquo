<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Actions\StoreMedia;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Streams a private media object; callers have already authorized access. */
final class MediaResponse
{
    public static function for(OrganizationMedia $media): StreamedResponse
    {
        $disk = Storage::disk(StoreMedia::disk());

        abort_unless($disk->exists($media->storage_key), 404);

        return $disk->response($media->storage_key, null, [
            'Content-Type' => $media->mime_type,
            'Cache-Control' => 'private, max-age=60',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
