<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Modules\Tenancy\Models\Organization;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * Base for settings requests. Authorization is the route's can:manage policy
 * middleware (Owner of the route-bound organization). Every id in the body is
 * checked against that organization, so cross-tenant ids are rejected here and
 * again by PostgreSQL's composite foreign keys.
 */
abstract class ConfigurationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function organization(): Organization
    {
        /** @var Organization $organization */
        $organization = $this->route('organization');

        return $organization;
    }

    /** The route-bound model for $name (scoped to the organization), if any. */
    protected function routeModel(string $name): ?Model
    {
        $model = $this->route($name);

        return $model instanceof Model ? $model : null;
    }

    /** Rule: the id exists in $table for this organization and is not archived. */
    protected function ownedActive(string $table): Exists
    {
        return Rule::exists($table, 'id')
            ->where('organization_id', $this->organization()->id)
            ->whereNull('archived_at');
    }

    /** Rule: name is unique (case-insensitive) among this organization's non-archived rows. */
    protected function uniqueName(string $table, ?int $ignoreId = null, ?string $scopeColumn = null, ?int $scopeId = null): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($table, $ignoreId, $scopeColumn, $scopeId): void {
            $query = DB::table($table)
                ->where('organization_id', $this->organization()->id)
                ->whereNull('archived_at')
                ->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) $value))]);

            if ($scopeColumn !== null) {
                $query->where($scopeColumn, $scopeId);
            }
            if ($ignoreId !== null) {
                $query->where('id', '!=', $ignoreId);
            }
            if ($query->exists()) {
                $fail('That name is already in use.');
            }
        };
    }
}
