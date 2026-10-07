<?php

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Model;

class JobRetry extends Model
{
    public const UPDATED_AT = null;

    public const CLAIMED = 'claimed';

    public const QUEUED = 'queued';

    public const DISPATCH_FAILED = 'dispatch_failed';

    protected $table = 'platform_job_retries';

    protected $fillable = ['job_uuid', 'job_class', 'queue', 'platform_admin_id', 'status', 'failed_at'];

    protected function casts(): array
    {
        return ['failed_at' => 'immutable_datetime', 'settled_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime'];
    }
}
