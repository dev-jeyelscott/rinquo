<?php

namespace App\Modules\Platform\Audit;

use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\PlatformAdmin;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Request;

/**
 * Writes the append-only platform audit stream. Callers pass allowlisted semantic values
 * only; the metadata keys below are the sole accepted ones, so a caller cannot accidentally
 * persist a request body, a secret or customer data. Call inside the transaction of the
 * change it records.
 */
final class PlatformAudit
{
    /** Keys that may appear in metadata. Anything else is dropped. */
    private const ALLOWED_METADATA = [
        'organization_id', 'support_session_id', 'target_user_id', 'target_admin_id', 'invitation_id',
        'job_uuid', 'job_class', 'queue', 'method', 'path_template', 'reference', 'plan_term_version_id',
        'amount_centavos', 'trial_days', 'grace_days', 'effective_at', 'reason_code', 'factor', 'cause',
    ];

    /** @param  array<string, scalar|null>  $metadata */
    public static function record(string $event, string $result, ?PlatformAdmin $actor = null, ?string $subjectType = null, int|string|null $subjectId = null, array $metadata = []): void
    {
        $requestId = Context::get('request_id');
        /** @var Route|null $current */
        $current = Request::route();
        $route = $current instanceof Route ? $current->getName() : null;

        AuditEvent::query()->create([
            'actor_admin_id' => $actor?->id,
            'event' => $event,
            'result' => $result,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId === null ? null : (string) $subjectId,
            'route' => is_string($route) ? mb_substr($route, 0, 120) : null,
            'correlation_id' => is_string($requestId) ? $requestId : null,
            'metadata' => $metadata === [] ? null : array_intersect_key($metadata, array_flip(self::ALLOWED_METADATA)),
        ]);
    }
}
