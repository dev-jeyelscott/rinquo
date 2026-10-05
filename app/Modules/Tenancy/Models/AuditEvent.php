<?php

namespace App\Modules\Tenancy\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only: there is no update or delete path in the application. */
class AuditEvent extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'organization_audit_events';

    protected $fillable = [
        'organization_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'before', 'after', 'request_id',
    ];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'created_at' => 'immutable_datetime'];
    }
}
