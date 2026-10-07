<?php

namespace App\Modules\Platform\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Support\Facades\Gate;

/**
 * The request-scoped identity of a support view: the admin who is acting, the tenant member
 * whose read policies apply, and the single organization in scope. It is resolved from the
 * durable session on every request and never persisted in the browser session.
 */
final class SupportContext
{
    public function __construct(
        public readonly SupportSession $session,
        public readonly PlatformAdmin $admin,
        public readonly User $target,
        public readonly Organization $organization,
        public readonly string $role,
    ) {}

    /** The tenant's own policy decisions, evaluated as the target member. Platform rights add nothing. */
    public function gate(): GateContract
    {
        return Gate::forUser($this->target);
    }

    /** Resolves the active membership that makes the target a valid support subject, or null. */
    public static function membershipOf(SupportSession $session): ?Membership
    {
        return Membership::query()
            ->where('organization_id', $session->organization_id)
            ->where('user_id', $session->target_user_id)
            ->where('is_active', true)
            ->first();
    }
}
