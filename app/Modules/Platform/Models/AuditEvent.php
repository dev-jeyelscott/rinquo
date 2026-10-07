<?php

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only: a database trigger rejects update and delete. */
class AuditEvent extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'platform_audit_events';

    protected $fillable = ['actor_admin_id', 'event', 'result', 'subject_type', 'subject_id', 'route', 'correlation_id', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'created_at' => 'immutable_datetime'];
    }
}
