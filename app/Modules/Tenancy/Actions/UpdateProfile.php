<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;

/** Updates the public profile, branding and the sole branch's location. */
final class UpdateProfile
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /**
     * @param  array{name: string, tagline: string, description: string, brand_color: string}  $profile
     * @param  array{name: string, address_line: string, city: string, phone: string|null}  $branch
     */
    public function handle(Organization $organization, User $actor, array $profile, array $branch): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($profile, $branch): void {
            $before = $locked->only(array_keys($profile));
            $locked->fill($profile)->save();
            $audit->record('organization.profile_updated', 'organization', $locked->id, $before, $profile);

            $model = $locked->branch()->firstOrFail();
            $branchBefore = $model->only(array_keys($branch));
            $model->fill($branch)->save();
            $audit->record('branch.updated', 'branch', $model->id, $branchBefore, $branch);
        });
    }
}
