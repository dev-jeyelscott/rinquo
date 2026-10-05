<?php

namespace App\Modules\Tenancy\Policies;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Auth\Access\Response;

/**
 * Scheduling-critical configuration is Owner-only. The actor, the action and
 * the route-bound organization are all resolved on the server. A user with no
 * membership in the organization gets a 404 so tenants cannot probe ids; a
 * Staff member gets a 403.
 */
class OrganizationPolicy
{
    public function manage(User $user, Organization $organization): Response
    {
        $membership = Membership::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();

        if ($membership === null) {
            return Response::denyAsNotFound();
        }

        return $membership->role === Membership::OWNER
            ? Response::allow()
            : Response::deny('Only an owner can change this configuration.');
    }

    /**
     * Day-to-day operation (for example deciding booking requests): any active
     * member, Owner or Staff. Non-members get a 404.
     */
    public function operate(User $user, Organization $organization): Response
    {
        $isMember = Membership::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->exists();

        return $isMember ? Response::allow() : Response::denyAsNotFound();
    }
}
