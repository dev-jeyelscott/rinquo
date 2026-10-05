<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;

final class UnpublishOrganization
{
    public function __construct(private readonly ChangeOrganization $change) {}

    public function handle(Organization $organization, User $actor): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit): void {
            if (! $locked->isPublished()) {
                return;
            }

            $locked->forceFill(['published_at' => null])->save();
            $audit->record('organization.unpublished', 'organization', $locked->id, ['published' => true], ['published' => false]);
        });
    }
}
