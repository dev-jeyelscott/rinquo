<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The explicit, Owner-requested closure: the only way a recovery deadline
 * starts. It records the closure and an audit event under the organization
 * lock and touches nothing else (subscription, memberships, publication,
 * bookings, media and customer identity are untouched). It deliberately does
 * not go through ChangeOrganization, so a restricted Owner can still close.
 */
final class RequestClosure
{
    public function handle(Organization $organization, User $actor, string $confirmedName): OrganizationClosure
    {
        return DB::transaction(function () use ($organization, $actor, $confirmedName): OrganizationClosure {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();

            if (trim($confirmedName) !== $locked->name) {
                throw ValidationException::withMessages(['confirmation' => 'Type the organization name exactly to confirm closing it.']);
            }
            if (OrganizationClosure::query()->where('organization_id', $locked->id)->whereNull('recovered_at')->exists()) {
                throw ValidationException::withMessages(['closure' => 'This organization is already closed.']);
            }

            $now = CarbonImmutable::now();
            $closure = new OrganizationClosure;
            $closure->forceFill([
                'organization_id' => $locked->id,
                'requested_by_user_id' => $actor->id,
                'requested_at' => $now,
                'recoverable_until' => $now->addDays(PlanTerms::current()->closureRecoveryDays),
            ])->save();

            (new AuditTrail($locked, $actor))->record('organization.closure_requested', 'organization', $locked->id, ['closed' => false], [
                'closed' => true,
                'recoverable_until' => $closure->recoverable_until->toIso8601String(),
            ]);

            return $closure;
        });
    }
}
