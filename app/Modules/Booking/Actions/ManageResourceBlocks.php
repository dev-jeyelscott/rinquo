<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\Occupancy;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Operational blocks of one physical resource (for example a bay out of
 * service). A block claims the whole resource through {@see Occupancy}, so it
 * is honoured by availability, walk-in gaps and assignment. It is created
 * through {@see ChangeOrganization} (organization lock first) and settles its
 * impact on future bookings before it commits: bookings that fit another
 * compatible resource at the same time are moved there, the rest become
 * explicit scheduling conflicts for Staff. Nothing is silently overbooked.
 */
final class ManageResourceBlocks
{
    public function __construct(private readonly ChangeOrganization $change) {}

    public function block(Organization $organization, User $actor, int $resourceId, CarbonImmutable $startsAt, CarbonImmutable $endsAt, string $reason): ResourceBlock
    {
        return $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($actor, $resourceId, $startsAt, $endsAt, $reason): ResourceBlock {
            $resource = PhysicalResource::query()->where('organization_id', $locked->id)->whereKey($resourceId)->first();
            if ($resource === null || ! $resource->is_active || $resource->archived_at !== null) {
                throw ValidationException::withMessages(['resource_id' => 'Choose an active resource of this shop.']);
            }
            if ($endsAt <= $startsAt || $endsAt <= CarbonImmutable::now()) {
                throw ValidationException::withMessages(['ends_at' => 'The block must end after it starts, in the future.']);
            }

            $existing = ResourceBlock::query()->where('organization_id', $locked->id)->where('physical_resource_id', $resource->id)->whereNull('released_at')
                ->where('starts_at', $startsAt)->where('ends_at', $endsAt)->first();
            if ($existing !== null) {
                return $existing;
            }

            $block = ResourceBlock::query()->create([
                'organization_id' => $locked->id, 'public_id' => (string) Str::uuid(), 'physical_resource_id' => $resource->id,
                'starts_at' => $startsAt, 'ends_at' => $endsAt, 'reason' => trim($reason), 'created_by_user_id' => $actor->id,
            ]);
            $audit->record('resource_block.create', 'resource_block', $block->id, null, [
                'resource_id' => $resource->id, 'starts_at' => $startsAt->utc()->toIso8601String(), 'ends_at' => $endsAt->utc()->toIso8601String(), 'reason' => $block->reason,
            ]);

            return $block;
        }, assessImpact: true, configurationWrite: false); // a day-of operational control, not subscription-gated configuration
    }

    public function release(Organization $organization, User $actor, string $publicId): ResourceBlock
    {
        return DB::transaction(function () use ($organization, $actor, $publicId): ResourceBlock {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $block = ResourceBlock::query()->where('organization_id', $locked->id)->where('public_id', $publicId)->lockForUpdate()->firstOrFail();
            if ($block->released_at !== null) {
                return $block;
            }
            $block->forceFill(['released_at' => now(), 'released_by_user_id' => $actor->id])->save();
            (new AuditTrail($locked, $actor))->record('resource_block.release', 'resource_block', $block->id, ['released' => false], ['released' => true]);

            return $block;
        });
    }
}
