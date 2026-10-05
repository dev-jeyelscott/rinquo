<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Atomically creates the organization, its sole branch, the Owner membership
 * and the first audit event, or nothing at all.
 */
final class CreateOrganization
{
    public function handle(User $owner, string $name, string $slug, string $branchName): Organization
    {
        try {
            return DB::transaction(function () use ($owner, $name, $slug, $branchName): Organization {
                // Serialize concurrent onboarding for the same user.
                User::query()->whereKey($owner->id)->lockForUpdate()->firstOrFail();

                if (Membership::query()->where('user_id', $owner->id)->where('role', Membership::OWNER)->exists()) {
                    throw ValidationException::withMessages(['name' => 'You already own an organization.']);
                }

                $organization = Organization::query()->create(['name' => $name, 'slug' => $slug]);
                $branch = $organization->branch()->create(['name' => $branchName]);
                Membership::query()->create([
                    'organization_id' => $organization->id,
                    'user_id' => $owner->id,
                    'role' => Membership::OWNER,
                ]);

                (new AuditTrail($organization, $owner))->record('organization.created', 'organization', $organization->id, null, [
                    'name' => $organization->name,
                    'slug' => $organization->slug,
                    'branch_id' => $branch->id,
                    'timezone' => Branch::TIMEZONE,
                ]);

                return $organization;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['slug' => 'This shop address is already taken.']);
        }
    }
}
