<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Facades\Context;

/**
 * Writes organization-scoped audit events. Callers pass allowlisted semantic
 * values only (never request bodies, secrets, OTP data or whole models), and
 * must call this inside the same database transaction as the change.
 */
final class AuditTrail
{
    public function __construct(
        private readonly Organization $organization,
        private readonly ?User $actor,
    ) {}

    /**
     * @param  array<string, scalar|array<array-key, mixed>|null>|null  $before
     * @param  array<string, scalar|array<array-key, mixed>|null>|null  $after
     */
    public function record(string $action, string $subjectType, ?int $subjectId, ?array $before = null, ?array $after = null): void
    {
        $requestId = Context::get('request_id');

        AuditEvent::query()->create([
            'organization_id' => $this->organization->id,
            'actor_user_id' => $this->actor?->id,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'before' => $before,
            'after' => $after,
            'request_id' => is_string($requestId) ? $requestId : null,
        ]);
    }
}
