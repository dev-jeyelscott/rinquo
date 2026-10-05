<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Stores tenant media on the private disk under a random key.
 *
 * The object is written before the database transaction (no storage call runs
 * inside a transaction) and deleted again if the transaction fails, so a failed
 * upload leaves no orphan. Replaced objects are removed only after the new row
 * has committed and the old row has been archived.
 */
final class StoreMedia
{
    public const GALLERY_LIMIT = 8;

    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function __construct(private readonly ChangeOrganization $change) {}

    public static function disk(): string
    {
        return (string) config('rinquo.media_disk');
    }

    public function handle(Organization $organization, User $actor, UploadedFile $file, string $kind, string $altText): OrganizationMedia
    {
        $mime = (string) $file->getMimeType();
        $extension = self::EXTENSIONS[$mime] ?? null;

        if ($extension === null) {
            throw ValidationException::withMessages(['file' => 'Upload a JPEG, PNG or WebP image.']);
        }

        $disk = Storage::disk(self::disk());
        $key = "organizations/{$organization->id}/media/".Str::ulid().".{$extension}";
        $disk->put($key, (string) file_get_contents($file->getRealPath()), ['visibility' => 'private']);

        $replaced = [];

        try {
            $media = $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($kind, $altText, $key, $mime, &$replaced): OrganizationMedia {
                $active = $locked->media()->active()->where('kind', $kind)->get();

                if ($kind === OrganizationMedia::GALLERY) {
                    if ($active->count() >= self::GALLERY_LIMIT) {
                        throw ValidationException::withMessages(['file' => 'The gallery can hold up to '.self::GALLERY_LIMIT.' photos.']);
                    }
                } else {
                    foreach ($active as $previous) {
                        $previous->forceFill(['archived_at' => now()])->save();
                        $replaced[] = $previous->storage_key;
                        $audit->record('media.archived', 'media', $previous->id, ['kind' => $kind], ['archived' => true]);
                    }
                }

                $media = OrganizationMedia::query()->create([
                    'organization_id' => $locked->id,
                    'kind' => $kind,
                    'storage_key' => $key,
                    'mime_type' => $mime,
                    'alt_text' => $altText,
                    'sort_order' => (int) $active->max('sort_order') + 1,
                ]);
                $audit->record('media.created', 'media', $media->id, null, ['kind' => $kind, 'alt_text' => $altText, 'mime_type' => $mime]);

                return $media;
            });
        } catch (Throwable $exception) {
            $disk->delete($key);

            throw $exception;
        }

        $this->deleteObjects($replaced);

        return $media;
    }

    /** @param  list<string>  $keys */
    private function deleteObjects(array $keys): void
    {
        foreach ($keys as $key) {
            try {
                Storage::disk(self::disk())->delete($key);
            } catch (Throwable $exception) {
                report($exception);
            }
        }
    }
}
