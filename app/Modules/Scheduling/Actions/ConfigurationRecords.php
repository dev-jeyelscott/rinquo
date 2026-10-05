<?php

namespace App\Modules\Scheduling\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Create, update and archive for catalog and resource records. Records are
 * archived or deactivated, never deleted, so history keeps stable ids. Every
 * write runs through {@see ChangeOrganization} (lock, audit, auto-unpublish).
 *
 * Callers pass validated, allowlisted attributes only; those same attributes
 * are what the audit event records.
 */
final class ConfigurationRecords
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /**
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $modelClass
     * @param  array<string, scalar|null>  $attributes
     * @return TModel
     */
    public function create(Organization $organization, User $actor, string $modelClass, string $subject, array $attributes): Model
    {
        return $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($modelClass, $subject, $attributes): Model {
            $record = new $modelClass;
            $record->forceFill(['organization_id' => $locked->id, ...$attributes])->save();
            $audit->record("{$subject}.created", $subject, $record->getKey(), null, $attributes);

            return $record;
        });
    }

    /**
     * @param  array<string, scalar|null>  $attributes
     */
    public function update(Organization $organization, User $actor, Model $record, string $subject, array $attributes): Model
    {
        return $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($record, $subject, $attributes): Model {
            $fresh = $this->lock($locked, $record);

            if ($fresh->getAttribute('archived_at') !== null) {
                throw ValidationException::withMessages(['record' => 'Archived records cannot be edited.']);
            }

            $before = $fresh->only(array_keys($attributes));
            $fresh->fill($attributes)->save();

            $action = 'updated';
            if (array_key_exists('is_active', $attributes) && (bool) $before['is_active'] !== (bool) $attributes['is_active']) {
                $action = $attributes['is_active'] ? 'activated' : 'deactivated';
            }
            $audit->record("{$subject}.{$action}", $subject, $fresh->getKey(), $before, $attributes);

            return $fresh;
        });
    }

    public function archive(Organization $organization, User $actor, Model $record, string $subject): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($record, $subject): void {
            $fresh = $this->lock($locked, $record);

            if ($fresh->getAttribute('archived_at') !== null) {
                return;
            }

            $fresh->forceFill(['is_active' => false, 'archived_at' => now()])->save();
            $audit->record("{$subject}.archived", $subject, $fresh->getKey(), ['archived' => false], ['archived' => true]);
        });
    }

    private function lock(Organization $organization, Model $record): Model
    {
        return $record::query()
            ->where('organization_id', $organization->id)
            ->whereKey($record->getKey())
            ->lockForUpdate()
            ->firstOrFail();
    }
}
