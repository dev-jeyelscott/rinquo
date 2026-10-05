<?php

namespace App\Modules\Scheduling\Models;

use Illuminate\Database\Eloquent\Builder;

/**
 * Records that future bookings can reference are archived or deactivated,
 * never deleted. A record is usable only while active and not archived.
 */
trait Archivable
{
    public function initializeArchivable(): void
    {
        $this->mergeCasts(['is_active' => 'boolean', 'archived_at' => 'immutable_datetime']);
    }

    public function isUsable(): bool
    {
        return $this->is_active && $this->archived_at === null;
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeNotArchived(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }
}
