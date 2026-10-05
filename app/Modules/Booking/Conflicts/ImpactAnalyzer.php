<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Availability\Claim;
use App\Modules\Booking\Availability\Occupancy;
use App\Modules\Booking\Availability\ResourceFeasibility;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Evaluates every future, not-yet-started live booking against the CURRENT
 * (already mutated, still uncommitted) configuration, and plans the smallest
 * outcome per booking: keep it where it is, move it to another compatible
 * resource at the SAME time, or flag a conflict.
 *
 * It uses the booking's immutable snapshot (start, occupied span, consumption
 * units, service span) and the one occupancy reader, never a dashboard-only
 * approximation. Bookings are planned together against a running claim map, so a
 * plan is feasible as a whole: first every booking that still fits where it is
 * keeps its place (oldest reservation first), then each disrupted booking looks
 * for the same time elsewhere, so a move can never over-allocate a resource or
 * bump an undisturbed booking. A booking that
 * already has an unresolved conflict keeps its claim and is not re-planned
 * (releasing a block never silently closes a conflict).
 *
 * Must run under the organization row lock, inside the change's transaction.
 */
final class ImpactAnalyzer
{
    /** Bounded work: a single change never plans more future bookings than this. */
    public const MAX_BOOKINGS = 2000;

    public function __construct(private readonly Occupancy $occupancy) {}

    public function analyze(Organization $organization, CarbonImmutable $now): ImpactPlan
    {
        $bookings = Booking::query()
            ->where('organization_id', $organization->id)
            ->where('scheduled_start_at', '>', $now)
            ->whereIn('operational_state', [Booking::SCHEDULED, Booking::CHECKED_IN])
            ->where(fn ($query) => $query->where('status', Booking::CONFIRMED)
                ->orWhere(fn ($pending) => $pending->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '>', $now)))
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from('scheduling_conflicts')
                ->whereColumn('scheduling_conflicts.booking_id', 'bookings.id')->where('scheduling_conflicts.status', '!=', 'resolved'))
            ->orderBy('id')
            ->limit(self::MAX_BOOKINGS + 1)
            ->get();

        if ($bookings->isEmpty()) {
            return new ImpactPlan([]);
        }
        if ($bookings->count() > self::MAX_BOOKINGS) {
            throw ValidationException::withMessages(['impact' => 'This shop has too many future bookings to review in one change.']);
        }

        $types = ResourceType::query()->where('organization_id', $organization->id)->get()->keyBy('id');
        $resources = PhysicalResource::query()->where('organization_id', $organization->id)->orderBy('id')->get()->keyBy('id');
        $usable = $resources->filter(fn (PhysicalResource $resource): bool => $this->isUsable($resource, $types->get($resource->resource_type_id)));
        $rules = CapacityConsumption::query()->where('organization_id', $organization->id)
            ->whereIn('service_vehicle_variant_id', $bookings->pluck('service_vehicle_variant_id')->unique())
            ->orderBy('resource_type_id')->get()->groupBy('service_vehicle_variant_id');

        $from = $bookings->min('scheduled_start_at');
        $to = $bookings->max('occupied_end_at');
        $claims = $this->occupancy->claims(
            $organization->id, array_values($usable->keys()->map(fn ($id): int => (int) $id)->all()), $from, $to, $now,
            excludeBookingIds: array_values($bookings->pluck('id')->map(fn ($id): int => (int) $id)->all()),
        );
        $blocks = ResourceBlock::query()->where('organization_id', $organization->id)->whereNull('released_at')
            ->where('starts_at', '<', $to)->where('ends_at', '>', $from)->get();
        $calendars = $this->calendars($organization, $bookings);

        // Pass 1: every booking that still fits where it is keeps its place, so an undisturbed
        // booking is never bumped to make room for a disrupted one.
        $deferred = [];
        $context = [];
        foreach ($bookings as $booking) {
            $current = $booking->claimedResourceId();
            $typeIds = array_values(($rules->get($booking->service_vehicle_variant_id) ?? collect())->pluck('resource_type_id')->map(fn ($id): int => (int) $id)->all());
            $hoursOk = $calendars[$booking->service_id]->covers($booking->scheduled_start_at, $booking->serviceMinutes());
            $context[$booking->id] = [$typeIds, $hoursOk];

            if ($hoursOk && $this->fitsOn($booking, $current, $typeIds, $usable, $claims)) {
                $claims[$current][] = $this->claim($booking);
            } else {
                $deferred[] = $booking;
            }
        }

        // Pass 2: disrupted bookings, oldest first, try the same time on another compatible resource.
        $items = [];
        foreach ($deferred as $booking) {
            $current = $booking->claimedResourceId();
            [$typeIds, $hoursOk] = $context[$booking->id];
            $cause = $this->cause($booking, $current, $hoursOk, $typeIds, $usable, $resources->get($current), $blocks);
            $target = $hoursOk ? $this->firstFit($booking, $current, $typeIds, $usable, $claims) : null;

            if ($target !== null) {
                $claims[$target][] = $this->claim($booking);
                $items[] = new ImpactItem($booking, ImpactItem::REASSIGNED, $cause, $current, $target);

                continue;
            }

            // Not fixable at the same time: the original slot stays reserved on its resource.
            if ($usable->has($current)) {
                $claims[$current][] = $this->claim($booking);
            }
            $items[] = new ImpactItem($booking, ImpactItem::CONFLICT, $cause, $current, null);
        }

        return new ImpactPlan($items);
    }

    private function claim(Booking $booking): Claim
    {
        return new Claim($booking->scheduled_start_at, $booking->occupied_end_at, $booking->consumption_units);
    }

    /**
     * Whether the booking still holds on $resourceId: usable, compatible with the variant's
     * current rules, large enough for its snapshot units and within the running claims.
     *
     * @param  list<int>  $typeIds
     * @param  Collection<int, PhysicalResource>  $usable
     * @param  array<int, list<Claim>>  $claims
     */
    private function fitsOn(Booking $booking, int $resourceId, array $typeIds, Collection $usable, array $claims): bool
    {
        $resource = $usable->get($resourceId);

        return $resource !== null
            && in_array($resource->resource_type_id, $typeIds, true)
            && ResourceFeasibility::fits($resource->capacity, $booking->consumption_units, $booking->scheduled_start_at, $booking->occupied_end_at, $claims[$resourceId] ?? []);
    }

    /**
     * The first compatible resource that holds the booking's snapshot claim: its current
     * resource first, then deterministic (rule resource type, resource id) order.
     *
     * @param  list<int>  $typeIds  compatible resource types (current rules for the variant)
     * @param  Collection<int, PhysicalResource>  $usable
     * @param  array<int, list<Claim>>  $claims
     */
    private function firstFit(Booking $booking, int $current, array $typeIds, Collection $usable, array $claims): ?int
    {
        $candidates = $usable->filter(fn (PhysicalResource $resource): bool => in_array($resource->resource_type_id, $typeIds, true) && $resource->capacity >= $booking->consumption_units)
            ->sortBy(fn (PhysicalResource $resource): array => [$resource->id === $current ? 0 : 1, array_search($resource->resource_type_id, $typeIds, true), $resource->id]);

        foreach ($candidates as $resource) {
            if (ResourceFeasibility::fits($resource->capacity, $booking->consumption_units, $booking->scheduled_start_at, $booking->occupied_end_at, $claims[$resource->id] ?? [])) {
                return $resource->id;
            }
        }

        return null;
    }

    /**
     * @param  list<int>  $typeIds
     * @param  Collection<int, PhysicalResource>  $usable
     * @param  Collection<int, ResourceBlock>  $blocks
     */
    private function cause(Booking $booking, int $current, bool $hoursOk, array $typeIds, Collection $usable, ?PhysicalResource $resource, Collection $blocks): string
    {
        return match (true) {
            ! $hoursOk => 'hours',
            ! $usable->has($current) => 'resource_unavailable',
            $resource === null || ! in_array($resource->resource_type_id, $typeIds, true) || $resource->capacity < $booking->consumption_units => 'compatibility',
            $blocks->contains(fn (ResourceBlock $block): bool => $block->physical_resource_id === $current && $block->starts_at < $booking->occupied_end_at && $block->ends_at > $booking->scheduled_start_at) => 'resource_blocked',
            default => 'capacity',
        };
    }

    private function isUsable(PhysicalResource $resource, ?ResourceType $type): bool
    {
        return $resource->is_active && $resource->archived_at === null
            && $type !== null && $type->is_active && $type->archived_at === null;
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return array<int, BranchCalendar>
     */
    private function calendars(Organization $organization, Collection $bookings): array
    {
        $first = BranchCalendar::localDate($bookings->min('scheduled_start_at'));
        $last = BranchCalendar::localDate($bookings->max('scheduled_start_at'));
        $calendars = [];
        foreach ($bookings->pluck('service_id')->unique() as $serviceId) {
            $calendars[(int) $serviceId] = BranchCalendar::load($organization->id, (int) $serviceId, $first, $last);
        }

        return $calendars;
    }
}
