<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Organization;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * The one door for scheduling-critical writes. In a single transaction it:
 *
 * 1. locks the organization row (one consistent lock order, so competing
 *    publishes and mutations serialize and cannot deadlock);
 * 2. runs the mutation, which records its own audit events;
 * 3. re-evaluates readiness, and if a published organization is no longer
 *    ready, clears published_at and audits the automatic unpublish.
 *
 * Repairing configuration never republishes: only the explicit Publish action
 * sets published_at. Network calls (storage, mail) stay outside the closure.
 */
final class ChangeOrganization
{
    public function __construct(private readonly ReadinessEvaluator $readiness) {}

    /**
     * @template T
     *
     * @param  Closure(Organization, AuditTrail): T  $mutation
     * @return T
     */
    public function handle(Organization $organization, User $actor, Closure $mutation): mixed
    {
        return DB::transaction(function () use ($organization, $actor, $mutation): mixed {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $audit = new AuditTrail($locked, $actor);

            $result = $mutation($locked, $audit);

            if ($locked->isPublished() && ! $this->readiness->evaluate($locked)->isReady()) {
                $locked->forceFill(['published_at' => null])->save();
                $audit->record('organization.unpublished_automatically', 'organization', $locked->id, ['published' => true], ['published' => false]);
            }

            $organization->setRawAttributes($locked->getAttributes(), true);

            return $result;
        });
    }
}
