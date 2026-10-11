<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Availability\Occupancy;
use App\Modules\Booking\Availability\ResourceFeasibility;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\NotificationFailure;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The staff dashboard read model for one operating day: counters, the queue
 * (appointment priority first, never changed by an early check-in), resource
 * load right now, active blocks and the tenant's open notification failures.
 * Every query is organization-scoped and bounded; the action flags and
 * compatible resources are server truth, which the operation endpoints then
 * re-validate. The queue is ordered by PostgreSQL and the queue, blocks and
 * failures are each paged (validated, URL-backed pages), so no actionable
 * record is silently omitted: counters and page metadata describe the whole
 * result, not the page.
 */
final class OperationsBoard
{
    private const QUEUE_LIMIT = 200;

    private const LIST_LIMIT = 50;

    /** Queue filters (the mobile Queue tabs); each maps to one operational state. */
    public const FILTERS = ['all' => null, 'checked_in' => Booking::CHECKED_IN, 'in_service' => Booking::IN_SERVICE, 'booked' => Booking::SCHEDULED];

    public function __construct(private readonly Occupancy $occupancy, private readonly BookingCatalog $catalog) {}

    /**
     * @param  array{queue_page?: int, blocks_page?: int, failures_page?: int, filter?: string}  $query  validated list state
     * @return array<string, mixed>
     */
    public function build(Organization $organization, CarbonImmutable $day, CarbonImmutable $now, array $query = []): array
    {
        $isToday = $day->equalTo(BranchCalendar::localDate($now));
        $filter = $query['filter'] ?? 'all';
        $dayBookings = fn () => Booking::query()
            ->where('organization_id', $organization->id)
            ->where('status', Booking::CONFIRMED)
            ->where('scheduled_start_at', '>=', $day->utc())
            ->where('scheduled_start_at', '<', $day->addDay()->utc());

        $resources = PhysicalResource::query()->where('organization_id', $organization->id)->where('is_active', true)->whereNull('archived_at')->orderBy('name')->orderBy('id')->get();
        $byId = $resources->keyBy('id');

        /** @var array<string, int> $counts */
        $counts = $dayBookings()->selectRaw('operational_state, count(*) as total')->groupBy('operational_state')->pluck('total', 'operational_state')->map(fn ($total): int => (int) $total)->all();
        $count = fn (string $state): int => $counts[$state] ?? 0;
        $delayed = $dayBookings()->where('operational_state', Booking::IN_SERVICE)->get()->filter(fn (Booking $b): bool => $b->projectedServiceEnd() > $b->service_end_at)->count();

        $queueQuery = $dayBookings()->when(self::FILTERS[$filter] ?? null, fn ($q, string $state) => $q->where('operational_state', $state))
            ->orderByRaw("CASE operational_state WHEN 'in_service' THEN 0 WHEN 'checked_in' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END")
            ->orderByRaw('COALESCE(queue_priority_at, scheduled_start_at)')
            ->orderBy('id');
        [$bookings, $queuePage] = $this->page($queueQuery, $query['queue_page'] ?? 1, self::QUEUE_LIMIT, fn ($q) => $q->with('addOns'));
        $queue = $bookings->map(fn (Booking $b): array => $this->row($b, $byId, $resources, $isToday, $now))->values()->all();

        [$blocks, $blocksPage] = $this->blocks($organization, $byId, $now, $query['blocks_page'] ?? 1);
        [$attention, $failuresPage] = $this->attention($organization, $query['failures_page'] ?? 1);

        return [
            'day' => ['date' => $day->toDateString(), 'isToday' => $isToday, 'timezone' => 'Asia/Manila', 'previous' => $day->subDay()->toDateString(), 'next' => $day->addDay()->toDateString(), 'today' => BranchCalendar::localDate($now)->toDateString()],
            'now' => $now->utc()->toIso8601String(),
            'stats' => [
                'appointments' => array_sum($counts), 'waiting' => $count(Booking::SCHEDULED), 'checkedIn' => $count(Booking::CHECKED_IN),
                'inService' => $count(Booking::IN_SERVICE), 'completed' => $count(Booking::COMPLETED), 'noShow' => $count(Booking::NO_SHOW),
                'delayed' => $delayed,
            ],
            'filter' => $filter,
            'queue' => $queue,
            'pages' => ['queue' => $queuePage, 'blocks' => $blocksPage, 'failures' => $failuresPage],
            'capacity' => $this->capacity($organization, $resources, $now),
            'blocks' => $blocks,
            'attention' => $attention,
            'resources' => $resources->map(fn (PhysicalResource $r): array => ['id' => $r->id, 'name' => $r->name, 'typeId' => $r->resource_type_id, 'capacity' => $r->capacity])->values()->all(),
            'catalog' => $this->catalog->build($organization),
        ];
    }

    /**
     * One bounded, stably ordered page. A page past the end resolves to the
     * nearest valid (last) page, so a mutation that empties a page never strands
     * the member on a blank one.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return array{0: Collection<int, TModel>, 1: array{page: int, perPage: int, total: int, lastPage: int, from: int, to: int}}
     */
    private function page($query, int $requested, int $perPage, ?callable $with = null): array
    {
        $total = (clone $query)->reorder()->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $requested), $lastPage);
        $items = ($with !== null ? $with($query) : $query)->forPage($page, $perPage)->get();
        $from = $items->isEmpty() ? 0 : ($page - 1) * $perPage + 1;

        return [$items, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => $lastPage, 'from' => $from, 'to' => $items->isEmpty() ? 0 : $from + $items->count() - 1]];
    }

    /**
     * @param  Collection<int, PhysicalResource>  $byId
     * @param  Collection<int, PhysicalResource>  $resources
     * @return array<string, mixed>
     */
    private function row(Booking $booking, Collection $byId, Collection $resources, bool $isToday, CarbonImmutable $now): array
    {
        $state = $booking->operational_state;
        $resource = $byId->get($booking->claimedResourceId());
        $queued = in_array($state, [Booking::SCHEDULED, Booking::CHECKED_IN], true);
        $inService = $state === Booking::IN_SERVICE;
        $eta = $inService ? $booking->projectedServiceEnd() : null;

        return [
            'id' => $booking->public_id,
            'customerName' => $booking->contact_name,
            'customerPhone' => $booking->contact_phone,
            'vehicleName' => $booking->vehicle_type_name,
            'vehiclePlate' => $booking->vehicle_plate,
            'serviceName' => $booking->service_name,
            'addOns' => $booking->addOns->pluck('name')->all(),
            'notes' => $booking->customer_notes,
            'resourceTypeName' => $booking->resource_type_name,
            'startAt' => $booking->scheduled_start_at->utc()->toIso8601String(),
            'serviceEndAt' => $booking->service_end_at->utc()->toIso8601String(),
            'etaAt' => $eta?->utc()->toIso8601String(),
            'delayMinutes' => $eta !== null ? max(0, (int) floor($booking->service_end_at->diffInMinutes($eta, false))) : 0,
            'state' => $state,
            'source' => $booking->source,
            'resource' => ['id' => $booking->claimedResourceId(), 'name' => $resource !== null ? $resource->name : 'Unavailable resource'],
            'units' => $booking->consumption_units,
            'compatibleResourceIds' => $queued
                ? $resources->filter(fn (PhysicalResource $r): bool => $r->resource_type_id === $booking->resource_type_id && $r->capacity >= $booking->consumption_units)->pluck('id')->values()->all()
                : [],
            'revision' => $booking->operation_revision,
            'graceMinutes' => $booking->lateArrivalGraceMinutes(),
            'noShowEligibleAt' => $booking->noShowEligibleAt()->utc()->toIso8601String(),
            'lateArrivalAt' => $booking->late_arrival_at?->utc()->toIso8601String(),
            'actions' => [
                'checkIn' => $isToday && $state === Booking::SCHEDULED,
                'start' => $isToday && $state === Booking::CHECKED_IN,
                'complete' => $inService,
                'noShow' => $state === Booking::SCHEDULED && $now >= $booking->noShowEligibleAt(),
                'assign' => $queued,
                'reorder' => $queued,
            ],
        ];
    }

    /**
     * @param  Collection<int, PhysicalResource>  $resources
     * @return list<array<string, mixed>>
     */
    private function capacity(Organization $organization, Collection $resources, CarbonImmutable $now): array
    {
        $claims = $this->occupancy->claims($organization->id, array_values($resources->pluck('id')->map(fn ($id): int => (int) $id)->all()), $now, $now->addMinute(), $now);

        return array_values($resources->map(function (PhysicalResource $resource) use ($claims, $now): array {
            $peak = ResourceFeasibility::peak($now, $now->addMinute(), $claims[$resource->id] ?? []);

            return ['id' => $resource->id, 'name' => $resource->name, 'capacity' => $resource->capacity, 'used' => min($peak, $resource->capacity), 'blocked' => $peak >= Occupancy::BLOCK_UNITS];
        })->all());
    }

    /**
     * @param  Collection<int, PhysicalResource>  $byId
     * @return array{0: list<array<string, mixed>>, 1: array{page: int, perPage: int, total: int, lastPage: int, from: int, to: int}}
     */
    private function blocks(Organization $organization, Collection $byId, CarbonImmutable $now, int $requested): array
    {
        [$items, $page] = $this->page(
            ResourceBlock::query()->where('organization_id', $organization->id)->whereNull('released_at')->where('ends_at', '>', $now)->orderBy('starts_at')->orderBy('id'),
            $requested,
            self::LIST_LIMIT,
        );

        return [array_values($items->map(fn (ResourceBlock $block): array => [
            'id' => $block->public_id, 'resourceId' => $block->physical_resource_id, 'resourceName' => $byId->has($block->physical_resource_id) ? $byId->get($block->physical_resource_id)->name : 'Resource',
            'startsAt' => $block->starts_at->utc()->toIso8601String(), 'endsAt' => $block->ends_at->utc()->toIso8601String(), 'reason' => $block->reason,
        ])->all()), $page];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: array{page: int, perPage: int, total: int, lastPage: int, from: int, to: int}}
     */
    private function attention(Organization $organization, int $requested): array
    {
        [$failures, $page] = $this->page(
            NotificationFailure::query()->where('organization_id', $organization->id)->whereIn('status', [NotificationFailure::FAILED, NotificationFailure::RETRYING])->orderByDesc('failed_at')->orderByDesc('id'),
            $requested,
            self::LIST_LIMIT,
        );
        $names = Booking::query()->where('organization_id', $organization->id)->whereIn('id', $failures->pluck('booking_id'))->pluck('contact_name', 'id');

        return [array_values($failures->map(fn (NotificationFailure $failure): array => [
            'id' => $failure->public_id, 'label' => $failure->label(), 'customerName' => $names[$failure->booking_id] ?? 'Customer',
            'status' => $failure->status, 'retryCount' => $failure->retry_count, 'failedAt' => $failure->failed_at->utc()->toIso8601String(),
        ])->all()), $page];
    }
}
