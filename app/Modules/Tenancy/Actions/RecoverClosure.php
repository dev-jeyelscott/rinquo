<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Recovers a closed organization before its deadline. The closure row is kept
 * as evidence (recovered_at and the recovering Owner). Afterwards access falls
 * back to the independent subscription state: an expired subscription recovers
 * as restricted, never as free access.
 */
final class RecoverClosure
{
    public function handle(Organization $organization, User $actor): OrganizationClosure
    {
        return DB::transaction(function () use ($organization, $actor): OrganizationClosure {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $closure = OrganizationClosure::query()->where('organization_id', $locked->id)->whereNull('recovered_at')->lockForUpdate()->first();

            if ($closure === null) {
                throw ValidationException::withMessages(['closure' => 'This organization is not closed.']);
            }

            $now = CarbonImmutable::now();
            if (! $closure->canRecoverAt($now)) {
                throw ValidationException::withMessages(['closure' => 'The recovery window has ended. Contact Rinquo Platform Operations.']);
            }

            $closure->forceFill(['recovered_at' => $now, 'recovered_by_user_id' => $actor->id])->save();

            (new AuditTrail($locked, $actor))->record('organization.closure_recovered', 'organization', $locked->id, ['closed' => true], ['closed' => false]);

            return $closure;
        });
    }
}
