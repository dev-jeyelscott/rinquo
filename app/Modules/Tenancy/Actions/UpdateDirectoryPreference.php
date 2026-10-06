<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;

final class UpdateDirectoryPreference
{
    public function __construct(private readonly ChangeOrganization $change) {}

    public function handle(Organization $organization, User $actor, bool $optedIn): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($optedIn): void {
            $before = ['directory_opted_in' => $locked->directory_opted_in];
            $locked->forceFill(['directory_opted_in' => $optedIn])->save();
            $audit->record('organization.directory_preference_updated', 'organization', $locked->id, $before, ['directory_opted_in' => $optedIn]);
        });
    }
}
