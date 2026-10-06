<?php

namespace App\Modules\Subscription\Models;

use App\Modules\Subscription\Support\PlanTerms;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An organization's entitlement instants. State is derived from them at read
 * time (see Access\AccessResolver); there is no stored status or restricted
 * flag.
 *
 * @property int $id
 * @property int $organization_id
 * @property CarbonImmutable $trial_ends_at
 * @property ?CarbonImmutable $paid_until
 * @property CarbonImmutable $grace_ends_at
 */
class Subscription extends Model
{
    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'immutable_datetime',
            'paid_until' => 'immutable_datetime',
            'grace_ends_at' => 'immutable_datetime',
        ];
    }

    /** The first subscription: a trial snapshot with its first grace end. */
    public static function startTrial(Organization $organization, ?PlanTerms $terms = null): self
    {
        $terms ??= PlanTerms::current();
        $trialEnds = CarbonImmutable::now()->addDays($terms->trialDays);

        $subscription = new self;
        $subscription->forceFill([
            'organization_id' => $organization->id,
            'trial_ends_at' => $trialEnds,
            'grace_ends_at' => $trialEnds->addDays($terms->graceDays),
        ])->save();

        return $subscription;
    }

    /** The instant paid or trial access ends, before grace. */
    public function accessEndsAt(): CarbonImmutable
    {
        return $this->paid_until !== null && $this->paid_until > $this->trial_ends_at ? $this->paid_until : $this->trial_ends_at;
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
