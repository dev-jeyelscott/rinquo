<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Support\Facades\Storage;
use Throwable;

/** Archives the metadata first, then removes the private object. */
final class ArchiveMedia
{
    public function __construct(private readonly ChangeOrganization $change) {}

    public function handle(Organization $organization, User $actor, OrganizationMedia $media): void
    {
        $archived = $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($media): bool {
            $current = OrganizationMedia::query()->where('organization_id', $locked->id)->whereKey($media->id)->firstOrFail();

            if ($current->archived_at !== null) {
                return false;
            }

            $current->forceFill(['archived_at' => now()])->save();
            $audit->record('media.archived', 'media', $current->id, ['kind' => $current->kind], ['archived' => true]);

            return true;
        });

        if ($archived) {
            try {
                Storage::disk(StoreMedia::disk())->delete($media->storage_key);
            } catch (Throwable $exception) {
                report($exception);
            }
        }
    }
}
