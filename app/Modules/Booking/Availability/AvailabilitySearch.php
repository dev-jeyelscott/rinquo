<?php

namespace App\Modules\Booking\Availability;

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Availability and capacity assignment. Customers only ever see a start time
 * and a boolean; the chosen resource stays internal.
 *
 * A variant's consumption rules are alternative compatible resource types, each
 * with its own units. A booking takes exactly one rule and ONE physical
 * resource, so capacity is never aggregated across resources. Candidates are
 * tried in a deterministic order (rule resource type id, then resource id).
 *
 * The claim path ({@see self::feasibleClaim()}) must run under the
 * organization row lock; the read-only search can run without it.
 */
final class AvailabilitySearch
{
    public function __construct(private readonly Occupancy $occupancy) {}

    /**
     * Service span in minutes: variant duration plus the add-on durations.
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public static function spanMinutes(ServiceVehicleVariant $variant, Collection $addOns): int
    {
        return $variant->duration_minutes + (int) $addOns->sum('duration_minutes');
    }

    /**
     * $excludeSessionHash (sha256 of a booking session token) leaves that
     * session's own active holds out of occupancy.
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public function forDate(
        Organization $organization,
        BookingPolicy $policy,
        ServiceVehicleVariant $variant,
        Collection $addOns,
        CarbonImmutable $localDate,
        ?CarbonImmutable $now = null,
        ?string $excludeSessionHash = null,
    ): DayAvailability {
        $now ??= CarbonImmutable::now();
        $calendar = BranchCalendar::load($organization->id, $variant->service_id, $localDate, $localDate);

        return $this->day($organization, $policy, $variant, $addOns, $localDate, $now, $calendar, $this->plan($variant), null, $excludeSessionHash);
    }

    /**
     * The first available start from today through the booking horizon, or null.
     * $excludeSessionHash leaves out that session's own active holds.
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public function nextAvailable(
        Organization $organization,
        BookingPolicy $policy,
        ServiceVehicleVariant $variant,
        Collection $addOns,
        ?CarbonImmutable $now = null,
        ?string $excludeSessionHash = null,
    ): ?CarbonImmutable {
        $now ??= CarbonImmutable::now();
        $today = BranchCalendar::localDate($now);
        $last = $today->addDays($policy->horizon_days);
        $calendar = BranchCalendar::load($organization->id, $variant->service_id, $today, $last);
        $plan = $this->plan($variant);

        if ($plan === []) {
            return null;
        }

        for ($date = $today; $date <= $last; $date = $date->addDay()) {
            $day = $this->day($organization, $policy, $variant, $addOns, $date, $now, $calendar, $plan, null, $excludeSessionHash);

            foreach ($day->times as $time) {
                if ($time['available']) {
                    return CarbonImmutable::parse($time['startAt']);
                }
            }
        }

        return null;
    }

    /**
     * Whether $start is a current candidate start for the offer (hours, windows,
     * grid, minimum notice and horizon), ignoring capacity.
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public function isCandidateStart(
        Organization $organization,
        BookingPolicy $policy,
        ServiceVehicleVariant $variant,
        Collection $addOns,
        CarbonImmutable $start,
        CarbonImmutable $now,
    ): bool {
        $localDate = BranchCalendar::localDate($start);
        $calendar = BranchCalendar::load($organization->id, $variant->service_id, $localDate, $localDate);

        foreach ($calendar->starts($localDate, self::spanMinutes($variant, $addOns), $policy, $now) as $candidate) {
            if ($candidate->equalTo($start)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Picks the compatible rule and single physical resource that can hold the
     * whole occupied span at $start, or null. $excludeHoldId removes the
     * caller's own hold from occupancy; $preferResourceId is tried first.
     *
     * @param  Collection<int, AddOn>  $addOns
     */
    public function feasibleClaim(
        Organization $organization,
        ServiceVehicleVariant $variant,
        Collection $addOns,
        CarbonImmutable $start,
        ?CarbonImmutable $now = null,
        ?int $excludeHoldId = null,
        ?int $preferResourceId = null,
    ): ?Assignment {
        $now ??= CarbonImmutable::now();
        $plan = $this->plan($variant);
        $end = self::occupiedEnd($variant, $addOns, $start);
        $claims = $this->occupancy->claims($organization->id, $this->resourceIds($plan), $start, $end, $now, $excludeHoldId);

        return $this->choose($plan, $claims, $start, $end, $preferResourceId);
    }

    /** @param  Collection<int, AddOn>  $addOns */
    public static function occupiedEnd(ServiceVehicleVariant $variant, Collection $addOns, CarbonImmutable $start): CarbonImmutable
    {
        return $start->addMinutes(self::spanMinutes($variant, $addOns) + $variant->buffer_minutes);
    }

    /**
     * @param  Collection<int, AddOn>  $addOns
     * @param  list<array{rule: CapacityConsumption, resources: list<PhysicalResource>}>  $plan
     * @param  array<int, list<Claim>>|null  $claims  preloaded occupancy covering the day, or null to load
     */
    private function day(
        Organization $organization,
        BookingPolicy $policy,
        ServiceVehicleVariant $variant,
        Collection $addOns,
        CarbonImmutable $localDate,
        CarbonImmutable $now,
        BranchCalendar $calendar,
        array $plan,
        ?array $claims,
        ?string $excludeSessionHash = null,
    ): DayAvailability {
        $starts = $calendar->starts($localDate, self::spanMinutes($variant, $addOns), $policy, $now);
        $closed = $calendar->isClosed($localDate);

        if ($starts === []) {
            return new DayAvailability($localDate->toDateString(), $closed, []);
        }

        $first = $starts[0];
        $lastEnd = self::occupiedEnd($variant, $addOns, $starts[array_key_last($starts)]);
        $claims ??= $this->occupancy->claims($organization->id, $this->resourceIds($plan), $first, $lastEnd, $now, null, $excludeSessionHash);

        $times = [];
        foreach ($starts as $start) {
            $times[] = [
                'startAt' => $start->utc()->toIso8601String(),
                'available' => $this->choose($plan, $claims, $start, self::occupiedEnd($variant, $addOns, $start), null) !== null,
            ];
        }

        return new DayAvailability($localDate->toDateString(), $closed, $times);
    }

    /**
     * @param  list<array{rule: CapacityConsumption, resources: list<PhysicalResource>}>  $plan
     * @param  array<int, list<Claim>>  $claims
     */
    private function choose(array $plan, array $claims, CarbonImmutable $start, CarbonImmutable $end, ?int $preferResourceId): ?Assignment
    {
        $candidates = [];
        foreach ($plan as $entry) {
            foreach ($entry['resources'] as $resource) {
                $candidates[] = new Assignment($entry['rule'], $resource);
            }
        }

        if ($preferResourceId !== null) {
            usort($candidates, fn (Assignment $a, Assignment $b): int => ($b->resource->id === $preferResourceId) <=> ($a->resource->id === $preferResourceId));
        }

        foreach ($candidates as $candidate) {
            if (ResourceFeasibility::fits($candidate->resource->capacity, $candidate->rule->units, $start, $end, $claims[$candidate->resource->id] ?? [])) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Compatible (rule, resources) pairs in deterministic order: usable resource
     * types only, and only active resources whose own capacity holds the rule.
     *
     * @return list<array{rule: CapacityConsumption, resources: list<PhysicalResource>}>
     */
    private function plan(ServiceVehicleVariant $variant): array
    {
        $rules = $variant->consumptions()->orderBy('resource_type_id')->get();
        $typeIds = ResourceType::query()
            ->where('organization_id', $variant->organization_id)
            ->whereIn('id', $rules->pluck('resource_type_id'))
            ->where('is_active', true)
            ->whereNull('archived_at')
            ->pluck('id')
            ->all();

        $resources = PhysicalResource::query()
            ->where('organization_id', $variant->organization_id)
            ->whereIn('resource_type_id', $typeIds)
            ->where('is_active', true)
            ->whereNull('archived_at')
            ->orderBy('id')
            ->get()
            ->groupBy('resource_type_id');

        $plan = [];
        foreach ($rules as $rule) {
            if (! in_array($rule->resource_type_id, $typeIds, true)) {
                continue;
            }

            /** @var list<PhysicalResource> $fitting */
            $fitting = array_values(($resources->get($rule->resource_type_id) ?? collect())
                ->filter(fn (PhysicalResource $resource): bool => $resource->capacity >= $rule->units)
                ->all());

            if ($fitting !== []) {
                $plan[] = ['rule' => $rule, 'resources' => $fitting];
            }
        }

        return $plan;
    }

    /**
     * @param  list<array{rule: CapacityConsumption, resources: list<PhysicalResource>}>  $plan
     * @return list<int>
     */
    private function resourceIds(array $plan): array
    {
        $ids = [];
        foreach ($plan as $entry) {
            foreach ($entry['resources'] as $resource) {
                $ids[] = $resource->id;
            }
        }

        return array_values(array_unique($ids));
    }
}
