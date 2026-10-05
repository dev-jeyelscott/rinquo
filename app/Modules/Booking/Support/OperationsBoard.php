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
use Illuminate\Support\Collection;

/**
 * The staff dashboard read model for one operating day: counters, the queue
 * (appointment priority first, never changed by an early check-in), resource
 * load right now, active blocks and the tenant's open notification failures.
 * Every query is organization-scoped and bounded; the action flags and
 * compatible resources are server truth, which the operation endpoints then
 * re-validate.
 */
final class OperationsBoard
{
    private const QUEUE_LIMIT = 200;

    private const LIST_LIMIT = 50;

    public function __construct(private readonly Occupancy $occupancy, private readonly BookingCatalog $catalog) {}

    /** @return array<string, mixed> */
    public function build(Organization $organization, CarbonImmutable $day, CarbonImmutable $now): array
    {
        $isToday = $day->equalTo(BranchCalendar::localDate($now));
        $bookings = Booking::query()
            ->where('organization_id', $organization->id)
            ->where('status', Booking::CONFIRMED)
            ->where('scheduled_start_at', '>=', $day->utc())
            ->where('scheduled_start_at', '<', $day->addDay()->utc())
            ->with('addOns')
            ->get();

        $resources = PhysicalResource::query()->where('organization_id', $organization->id)->where('is_active', true)->whereNull('archived_at')->orderBy('name')->orderBy('id')->get();
        $byId = $resources->keyBy('id');
        $order = [Booking::IN_SERVICE => 0, Booking::CHECKED_IN => 1, Booking::SCHEDULED => 2, Booking::COMPLETED => 3, Booking::NO_SHOW => 3];
        $queue = $bookings
            ->sortBy(fn (Booking $b): array => [$order[$b->operational_state] ?? 4, $b->queueKey()->getTimestamp(), $b->queueKey()->micro, $b->id])
            ->take(self::QUEUE_LIMIT)
            ->map(fn (Booking $b): array => $this->row($b, $byId, $resources, $isToday, $now))
            ->values()->all();

        $count = fn (string $state): int => $bookings->where('operational_state', $state)->count();

        return [
            'day' => ['date' => $day->toDateString(), 'isToday' => $isToday, 'timezone' => 'Asia/Manila', 'previous' => $day->subDay()->toDateString(), 'next' => $day->addDay()->toDateString(), 'today' => BranchCalendar::localDate($now)->toDateString()],
            'now' => $now->utc()->toIso8601String(),
            'stats' => [
                'appointments' => $bookings->count(), 'waiting' => $count(Booking::SCHEDULED), 'checkedIn' => $count(Booking::CHECKED_IN),
                'inService' => $count(Booking::IN_SERVICE), 'completed' => $count(Booking::COMPLETED), 'noShow' => $count(Booking::NO_SHOW),
            ],
            'queue' => $queue,
            'capacity' => $this->capacity($organization, $resources, $now),
            'blocks' => $this->blocks($organization, $byId, $now),
            'attention' => $this->attention($organization),
            'resources' => $resources->map(fn (PhysicalResource $r): array => ['id' => $r->id, 'name' => $r->name, 'typeId' => $r->resource_type_id, 'capacity' => $r->capacity])->values()->all(),
            'catalog' => $this->catalog->build($organization),
        ];
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
            'actions' => [
                'checkIn' => $isToday && $state === Booking::SCHEDULED,
                'start' => $isToday && $state === Booking::CHECKED_IN,
                'complete' => $inService,
                'noShow' => $state === Booking::SCHEDULED && $now >= $booking->scheduled_start_at,
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
     * @return list<array<string, mixed>>
     */
    private function blocks(Organization $organization, Collection $byId, CarbonImmutable $now): array
    {
        return array_values(ResourceBlock::query()->where('organization_id', $organization->id)->whereNull('released_at')->where('ends_at', '>', $now)
            ->orderBy('starts_at')->limit(self::LIST_LIMIT)->get()
            ->map(fn (ResourceBlock $block): array => [
                'id' => $block->public_id, 'resourceId' => $block->physical_resource_id, 'resourceName' => $byId->has($block->physical_resource_id) ? $byId->get($block->physical_resource_id)->name : 'Resource',
                'startsAt' => $block->starts_at->utc()->toIso8601String(), 'endsAt' => $block->ends_at->utc()->toIso8601String(), 'reason' => $block->reason,
            ])->all());
    }

    /** @return list<array<string, mixed>> */
    private function attention(Organization $organization): array
    {
        $failures = NotificationFailure::query()->where('organization_id', $organization->id)->whereIn('status', [NotificationFailure::FAILED, NotificationFailure::RETRYING])
            ->orderByDesc('failed_at')->limit(self::LIST_LIMIT)->get();
        $names = Booking::query()->where('organization_id', $organization->id)->whereIn('id', $failures->pluck('booking_id'))->pluck('contact_name', 'id');

        return array_values($failures->map(fn (NotificationFailure $failure): array => [
            'id' => $failure->public_id, 'label' => $failure->label(), 'customerName' => $names[$failure->booking_id] ?? 'Customer',
            'status' => $failure->status, 'retryCount' => $failure->retry_count, 'failedAt' => $failure->failed_at->utc()->toIso8601String(),
        ])->all());
    }
}
