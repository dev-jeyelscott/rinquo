<?php

namespace App\Modules\Tenancy\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * An explicit Owner closure and its recovery window. Independent of billing:
 * only the closure actions and the eligibility command write it.
 *
 * @property int $id
 * @property int $organization_id
 * @property int $requested_by_user_id
 * @property CarbonImmutable $requested_at
 * @property CarbonImmutable $recoverable_until
 * @property ?CarbonImmutable $recovered_at
 * @property ?int $recovered_by_user_id
 * @property ?CarbonImmutable $deletion_eligible_at
 */
class OrganizationClosure extends Model
{
    public const RECOVERABLE = 'recoverable';

    public const DELETION_ELIGIBLE = 'deletion_eligible';

    protected function casts(): array
    {
        return [
            'requested_at' => 'immutable_datetime',
            'recoverable_until' => 'immutable_datetime',
            'recovered_at' => 'immutable_datetime',
            'deletion_eligible_at' => 'immutable_datetime',
        ];
    }

    /** Recoverable until its deadline; after that the Owner can no longer recover it. */
    public function canRecoverAt(CarbonImmutable $at): bool
    {
        return $this->recovered_at === null && $at < $this->recoverable_until;
    }

    public function stateAt(CarbonImmutable $at): string
    {
        return $this->canRecoverAt($at) ? self::RECOVERABLE : self::DELETION_ELIGIBLE;
    }
}
