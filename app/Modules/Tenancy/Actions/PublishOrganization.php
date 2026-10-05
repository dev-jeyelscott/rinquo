<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Validation\ValidationException;

/**
 * Explicit Publish. Readiness is recomputed from the database while the
 * organization row is locked, so a forged request, a stale page or a racing
 * mutation cannot publish an unready organization.
 */
final class PublishOrganization
{
    public function __construct(
        private readonly ChangeOrganization $change,
        private readonly ReadinessEvaluator $readiness,
    ) {}

    public function handle(Organization $organization, User $actor): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit): void {
            if ($locked->isPublished()) {
                return; // Duplicate publish: harmless, no misleading transition.
            }

            $result = $this->readiness->evaluate($locked);

            if (! $result->isReady()) {
                throw ValidationException::withMessages([
                    'publish' => 'Complete every readiness check before publishing: '
                        .implode(', ', array_map(fn (array $item): string => $item['label'], $result->failingItems())).'.',
                ]);
            }

            $locked->forceFill(['published_at' => now()])->save();
            $audit->record('organization.published', 'organization', $locked->id, ['published' => false], ['published' => true]);
        });
    }
}
