<?php

use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Subscription\Access\OrganizationAccess;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Support\PaidThrough;
use App\Modules\Subscription\Support\PlanTerms;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Tests\Support\Billing;
use Tests\Support\Tenant;

function manila(string $local): CarbonImmutable
{
    return CarbonImmutable::parse($local, 'Asia/Manila')->utc();
}

test('a new organization starts a trial snapshot with its first grace end', function () {
    // The locked defaults (Decision 105): a 14-day trial and a 3-day grace, whatever a developer's .env sets.
    config(['rinquo.subscription.trial_days' => 14, 'rinquo.subscription.grace_days' => 3]);
    $this->travelTo(manila('2026-10-05 08:00'));
    [, $organization] = Tenant::organization();

    $subscription = Subscription::query()->where('organization_id', $organization->id)->sole();

    expect($subscription->trial_ends_at->equalTo(manila('2026-10-19 08:00')))->toBeTrue()
        ->and($subscription->grace_ends_at->equalTo(manila('2026-10-22 08:00')))->toBeTrue()
        ->and($subscription->paid_until)->toBeNull();
});

test('there is one subscription per organization', function () {
    [, $organization] = Tenant::organization();

    expect(fn () => Subscription::startTrial($organization))->toThrow(QueryException::class);
});

test('state is derived from instants and changes exactly at each boundary', function () {
    [, $organization] = Tenant::organization();
    $trialEnds = manila('2026-10-10 12:00');
    $paidUntil = manila('2026-11-10 12:00');
    $graceEnds = manila('2026-11-17 12:00');
    $subscription = Billing::set($organization, $trialEnds, $paidUntil, $graceEnds);
    $at = fn (CarbonImmutable $instant): string => AccessResolver::entitlementAt($subscription, $instant);

    expect($at($trialEnds->subSecond()))->toBe(OrganizationAccess::TRIAL)
        ->and($at($trialEnds))->toBe(OrganizationAccess::PAID)
        ->and($at($paidUntil->subSecond()))->toBe(OrganizationAccess::PAID)
        ->and($at($paidUntil))->toBe(OrganizationAccess::GRACE)
        ->and($at($graceEnds->subSecond()))->toBe(OrganizationAccess::GRACE)
        ->and($at($graceEnds))->toBe(OrganizationAccess::RESTRICTED);
});

test('grace stays bookable until its exact end and restriction keeps existing operations', function () {
    [, $organization] = Tenant::organization();
    $graceEnds = manila('2026-11-17 12:00');
    Billing::set($organization, manila('2026-10-10 12:00'), manila('2026-11-10 12:00'), $graceEnds);
    $resolver = app(AccessResolver::class);

    $inGrace = $resolver->for($organization, $graceEnds->subSecond());
    $restricted = $resolver->for($organization, $graceEnds);

    expect($inGrace->acceptsNewBookings())->toBeTrue()->and($inGrace->allowsConfigurationWrites())->toBeTrue()
        ->and($restricted->acceptsNewBookings())->toBeFalse()->and($restricted->allowsConfigurationWrites())->toBeFalse()
        ->and($restricted->allowsCustomerReschedule())->toBeFalse()
        ->and($restricted->allowsExistingOperations())->toBeTrue()->and($restricted->allowsCustomerCancellation())->toBeTrue()
        ->and($restricted->isClosed())->toBeFalse();
});

test('a payment during the trial starts its month at trial end', function () {
    $trialEnds = manila('2026-10-20 08:00');
    $anchor = PaidThrough::anchor($trialEnds, null, manila('2026-10-06 09:00'));

    expect($anchor->equalTo($trialEnds))->toBeTrue()
        ->and(PaidThrough::monthAfter($anchor)->equalTo(manila('2026-11-20 08:00')))->toBeTrue();
});

test('early renewal extends the existing paid-through date, repeatedly', function () {
    $trialEnds = manila('2026-10-20 08:00');
    $first = PaidThrough::monthAfter(PaidThrough::anchor($trialEnds, null, manila('2026-10-06 09:00')));
    $second = PaidThrough::monthAfter(PaidThrough::anchor($trialEnds, $first, manila('2026-10-07 09:00')));

    expect($first->equalTo(manila('2026-11-20 08:00')))->toBeTrue()
        ->and($second->equalTo(manila('2026-12-20 08:00')))->toBeTrue();
});

test('an expired renewal starts at the provider-confirmed payment time', function () {
    $paidAt = manila('2026-12-05 14:30');
    $anchor = PaidThrough::anchor(manila('2026-10-20 08:00'), manila('2026-11-20 08:00'), $paidAt);

    expect($anchor->equalTo($paidAt))->toBeTrue()
        ->and(PaidThrough::monthAfter($anchor)->equalTo(manila('2027-01-05 14:30')))->toBeTrue();
});

test('a calendar month never overflows and is counted in Asia/Manila', function (string $from, string $expected) {
    expect(PaidThrough::monthAfter(manila($from))->equalTo(manila($expected)))->toBeTrue();
})->with([
    'jan 31 to feb 28' => ['2027-01-31 10:00', '2027-02-28 10:00'],
    'jan 31 leap year' => ['2028-01-31 10:00', '2028-02-29 10:00'],
    'dec rolls the year' => ['2026-12-15 23:30', '2027-01-15 23:30'],
]);

test('grace is refreshed from the new paid-through date using the current term', function () {
    config(['rinquo.subscription.grace_days' => 10]);

    expect(PaidThrough::graceEnds(manila('2026-11-20 08:00'), PlanTerms::current()->graceDays)->equalTo(manila('2026-11-30 08:00')))->toBeTrue();
});

test('plan terms are validated in one place', function () {
    config(['rinquo.subscription.qr_lifetime_seconds' => 30]);
    expect(fn () => PlanTerms::current())->toThrow(InvalidArgumentException::class);

    config(['rinquo.subscription.qr_lifetime_seconds' => 9001]);
    expect(fn () => PlanTerms::current())->toThrow(InvalidArgumentException::class);

    config(['rinquo.subscription.qr_lifetime_seconds' => 1800, 'rinquo.subscription.amount_centavos' => 0]);
    expect(fn () => PlanTerms::current())->toThrow(InvalidArgumentException::class);
});

test('the database rejects incoherent entitlement instants', function () {
    [, $organization] = Tenant::organization();

    expect(fn () => Billing::set($organization, manila('2026-10-20 08:00'), manila('2026-10-10 08:00'), manila('2026-12-01 08:00')))->toThrow(QueryException::class);
});
