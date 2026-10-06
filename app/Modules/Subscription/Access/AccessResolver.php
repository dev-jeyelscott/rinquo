<?php

namespace App\Modules\Subscription\Access;

use App\Modules\Subscription\Models\Subscription;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Projects entitlement and closure into capabilities. Always reads the current
 * rows (never a cached relation), so a lock-protected action sees what the
 * database holds after the organization lock. A missing subscription row fails
 * closed as restricted.
 */
final class AccessResolver
{
    public function for(Organization $organization, ?CarbonImmutable $at = null): OrganizationAccess
    {
        $at ??= CarbonImmutable::now();
        $subscription = Subscription::query()->where('organization_id', $organization->id)->first();
        $closure = OrganizationClosure::query()->where('organization_id', $organization->id)->whereNull('recovered_at')->first();

        return new OrganizationAccess(
            $subscription === null ? OrganizationAccess::RESTRICTED : self::entitlementAt($subscription, $at),
            $at,
            $subscription?->trial_ends_at,
            $subscription?->paid_until,
            $subscription?->grace_ends_at,
            $closure,
        );
    }

    /** Grace is writable up to its exact end instant; restriction begins at that boundary. */
    public static function entitlementAt(Subscription $subscription, CarbonImmutable $at): string
    {
        return match (true) {
            $at < $subscription->trial_ends_at => OrganizationAccess::TRIAL,
            $subscription->paid_until !== null && $at < $subscription->paid_until => OrganizationAccess::PAID,
            $at < $subscription->grace_ends_at => OrganizationAccess::GRACE,
            default => OrganizationAccess::RESTRICTED,
        };
    }

    /**
     * Restricts an organizations query to those that may accept new bookings
     * now (not restricted, no unrecovered closure). Used by the directory.
     *
     * @param  Builder<Organization>  $query
     * @return Builder<Organization>
     */
    public function scopeAcceptingNewBookings(Builder $query, ?CarbonImmutable $at = null): Builder
    {
        $at ??= CarbonImmutable::now();

        return $query
            ->whereExists(fn ($sub) => $sub->selectRaw('1')->from('subscriptions')
                ->whereColumn('subscriptions.organization_id', 'organizations.id')->where('subscriptions.grace_ends_at', '>', $at))
            ->whereNotExists(fn ($closure) => $closure->selectRaw('1')->from('organization_closures')
                ->whereColumn('organization_closures.organization_id', 'organizations.id')->whereNull('organization_closures.recovered_at'));
    }

    /** Server-authoritative gate for configuration writes, called under the organization lock. */
    public function assertConfigurationWritable(Organization $organization): void
    {
        $access = $this->for($organization);

        if (! $access->allowsConfigurationWrites()) {
            throw ValidationException::withMessages(['access' => $access->isClosed()
                ? 'This organization is closed. Recover it before changing its configuration.'
                : 'Your subscription has ended, so configuration is read-only. Renew to make changes.']);
        }
    }

    /** Server-authoritative gate for every path that creates new bookable work. */
    public function assertAcceptingNewBookings(Organization $organization): void
    {
        $access = $this->for($organization);

        if (! $access->acceptsNewBookings()) {
            throw ValidationException::withMessages(['access' => $access->newBookingBlockReason()]);
        }
    }
}
