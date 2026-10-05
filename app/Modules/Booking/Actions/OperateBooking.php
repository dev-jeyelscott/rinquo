<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Availability\Occupancy;
use App\Modules\Booking\Availability\ResourceFeasibility;
use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Mail\BookingCompletedMail;
use App\Modules\Booking\Mail\BookingNoShowMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Booking\Support\OperationJournal;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Day-of operations on a confirmed booking: check in, assign a resource, start,
 * complete, confirm a no-show and reorder the queue.
 *
 * Every mutation locks the organization first (the lock every capacity claim
 * shares), then the booking, and is idempotent per (organization, key). The
 * client sends the operation revision it saw; a stale one is rejected. Only
 * operational facts change: the fulfillment snapshot stays as booked, and each
 * change appends one operation event and one audit entry.
 */
final class OperateBooking
{
    public function __construct(private readonly Occupancy $occupancy) {}

    public function checkIn(Organization $organization, int $bookingId, User $actor, int $revision, string $key): Booking
    {
        return $this->run($organization, $bookingId, $actor, $revision, $key, 'check_in', [], function (Booking $booking, CarbonImmutable $now): array {
            $this->requireState($booking, [Booking::SCHEDULED], 'Only a booked, not yet arrived customer can be checked in.');
            $this->requireToday($booking, $now, 'Check-in opens on the day of the appointment.');
            $booking->forceFill(['operational_state' => Booking::CHECKED_IN, 'checked_in_at' => $now]);

            return ['early_minutes' => max(0, (int) floor($now->diffInMinutes($booking->scheduled_start_at, false)))];
        });
    }

    public function assign(Organization $organization, int $bookingId, User $actor, int $revision, string $key, int $resourceId): Booking
    {
        return $this->run($organization, $bookingId, $actor, $revision, $key, 'assign', ['resource' => $resourceId], function (Booking $booking, CarbonImmutable $now) use ($organization, $resourceId): array {
            $this->requireState($booking, [Booking::SCHEDULED, Booking::CHECKED_IN], 'A resource can only be changed before service starts.');
            if ($resourceId === $booking->claimedResourceId()) {
                throw ValidationException::withMessages(['resource_id' => 'The booking is already on that resource.']);
            }
            $resource = $this->assignableResource($organization, $booking, $resourceId);
            [$from, $to] = $this->neededSpan($booking, $now);
            $claims = $this->occupancy->claims($organization->id, [$resource->id], $from, $to, $now, null, null, $booking->id)[$resource->id] ?? [];
            if (! ResourceFeasibility::fits($resource->capacity, $booking->consumption_units, $from, $to, $claims)) {
                throw ValidationException::withMessages(['resource_id' => "{$resource->name} is blocked or full for this booking's time."]);
            }
            $previous = $booking->claimedResourceId();
            $booking->forceFill(['actual_resource_id' => $resource->id]);

            return ['__from_resource' => $previous, '__to_resource' => $resource->id];
        });
    }

    public function start(Organization $organization, int $bookingId, User $actor, int $revision, string $key): Booking
    {
        return $this->run($organization, $bookingId, $actor, $revision, $key, 'start', [], function (Booking $booking, CarbonImmutable $now) use ($organization): array {
            $this->requireState($booking, [Booking::CHECKED_IN], 'Check the customer in before starting service.');
            $this->requireToday($booking, $now, 'Service can only start on the day of the appointment.');
            $resourceId = $booking->claimedResourceId();
            $resource = PhysicalResource::query()->where('organization_id', $organization->id)->whereKey($resourceId)->first();
            if ($resource === null || ! $resource->is_active || $resource->archived_at !== null) {
                throw ValidationException::withMessages(['resource_id' => 'The assigned resource is no longer in use. Assign another one first.']);
            }

            $projectedEnd = $now->addMinutes($booking->serviceMinutes() + $booking->buffer_minutes);
            $claims = $this->occupancy->claims($organization->id, [$resourceId], $now, $projectedEnd, $now, null, null, $booking->id)[$resourceId] ?? [];
            $blocks = array_values(array_filter($claims, fn ($claim): bool => $claim->units === Occupancy::BLOCK_UNITS));
            $occupiedNow = ResourceFeasibility::fits($resource->capacity, $booking->consumption_units, $now, $now->addMinute(), $claims);
            if ($blocks !== [] || ! $occupiedNow) {
                throw ValidationException::withMessages(['resource_id' => "{$resource->name} is blocked or still occupied. Assign another resource or wait."]);
            }

            $booking->forceFill(['operational_state' => Booking::IN_SERVICE, 'started_at' => $now, 'actual_resource_id' => $resourceId]);

            return [
                '__to_resource' => $resourceId,
                'eta_at' => $now->addMinutes($booking->serviceMinutes())->utc()->toIso8601String(),
                'late_minutes' => max(0, (int) floor($booking->scheduled_start_at->diffInMinutes($now, false))),
            ];
        });
    }

    /** Completion keeps the configured buffer from the actual finish unless the buffer is released with a reason. */
    public function complete(Organization $organization, int $bookingId, User $actor, int $revision, string $key, bool $releaseBuffer, ?string $reason): Booking
    {
        $reason = $reason === null || trim($reason) === '' ? null : trim($reason);

        return $this->run($organization, $bookingId, $actor, $revision, $key, 'complete', ['release_buffer' => $releaseBuffer, 'reason' => $reason], function (Booking $booking, CarbonImmutable $now) use ($releaseBuffer, $reason): array {
            $this->requireState($booking, [Booking::IN_SERVICE], 'Only work in service can be completed.');
            if ($releaseBuffer && $reason === null) {
                throw ValidationException::withMessages(['reason' => 'Give a reason to release the buffer early.']);
            }
            $done = $now->max($booking->started_at);
            $booking->forceFill([
                'operational_state' => Booking::COMPLETED,
                'completed_at' => $done,
                'capacity_release_at' => $releaseBuffer ? $done : $done->addMinutes($booking->buffer_minutes),
            ]);
            BookingNotifier::queueIfAddressed($booking->contact_email, new BookingCompletedMail($booking->id));

            return ['buffer_released' => $releaseBuffer, 'overrun_minutes' => max(0, (int) floor($booking->service_end_at->diffInMinutes($done, false))), '__reason' => $reason];
        });
    }

    /** A no-show frees capacity only now, when staff confirm it after the appointment time. */
    public function markNoShow(Organization $organization, int $bookingId, User $actor, int $revision, string $key, string $reason): Booking
    {
        return $this->run($organization, $bookingId, $actor, $revision, $key, 'no_show', ['reason' => trim($reason)], function (Booking $booking, CarbonImmutable $now) use ($reason): array {
            $this->requireState($booking, [Booking::SCHEDULED], 'Only a booking that has not arrived can be marked as a no-show.');
            if ($now < $booking->scheduled_start_at) {
                throw ValidationException::withMessages(['booking' => 'A no-show can only be confirmed once the appointment time has passed.']);
            }
            $booking->forceFill(['operational_state' => Booking::NO_SHOW, 'no_show_at' => $now, 'capacity_release_at' => $now]);
            BookingNotifier::queueIfAddressed($booking->contact_email, new BookingNoShowMail($booking->id));

            return ['__reason' => trim($reason)];
        });
    }

    /**
     * Moves a queued booking directly before another. It changes ready order
     * only: appointment times, resources and capacity claims are untouched, and a
     * walk-in can never jump an unstarted appointment on its own resource.
     */
    public function reorder(Organization $organization, int $bookingId, User $actor, int $revision, string $key, string $beforePublicId, string $reason): Booking
    {
        return $this->run($organization, $bookingId, $actor, $revision, $key, 'reorder', ['before' => $beforePublicId, 'reason' => trim($reason)], function (Booking $booking, CarbonImmutable $now) use ($organization, $beforePublicId, $reason): array {
            $queued = [Booking::SCHEDULED, Booking::CHECKED_IN];
            $this->requireState($booking, $queued, 'Only queued work can be reordered.');
            $target = Booking::query()->where('organization_id', $organization->id)->where('public_id', $beforePublicId)->where('status', Booking::CONFIRMED)->whereIn('operational_state', $queued)->lockForUpdate()->first();
            if ($target === null || $target->id === $booking->id) {
                throw ValidationException::withMessages(['before' => 'Choose another queued booking to move ahead of.']);
            }
            if ($booking->source === Booking::SOURCE_WALK_IN && $target->source !== Booking::SOURCE_WALK_IN
                && $target->claimedResourceId() === $booking->claimedResourceId() && $target->scheduled_start_at <= $booking->scheduled_start_at) {
                throw ValidationException::withMessages(['before' => 'A walk-in cannot be moved ahead of a confirmed appointment on the same resource.']);
            }

            $day = BranchCalendar::localDate($booking->scheduled_start_at);
            $queue = Booking::query()->where('organization_id', $organization->id)->where('status', Booking::CONFIRMED)->whereIn('operational_state', $queued)
                ->where('scheduled_start_at', '>=', $day->utc())->where('scheduled_start_at', '<', $day->addDay()->utc())
                ->lockForUpdate()->get()->sortBy(fn (Booking $b): array => [$b->queueKey()->getTimestamp(), $b->queueKey()->micro, $b->id])->values();
            if (! $queue->contains('id', $target->id)) {
                throw ValidationException::withMessages(['before' => 'Both bookings must be queued on the same day.']);
            }

            $before = $queue->search(fn (Booking $b): bool => $b->id === $booking->id) + 1;
            $order = $queue->reject(fn (Booking $b): bool => $b->id === $booking->id)->values();
            $order->splice((int) $order->search(fn (Booking $b): bool => $b->id === $target->id), 0, [$booking]);
            $after = $order->search(fn (Booking $b): bool => $b->id === $booking->id) + 1;

            $last = null;
            foreach ($order as $item) {
                $keyAt = $item->id === $booking->id ? ($last ?? $target->queueKey()->subSecond()) : $item->queueKey();
                if ($last !== null && $keyAt <= $last) {
                    $keyAt = $last->addMicrosecond();
                }
                if ($item->id === $booking->id) {
                    $booking->forceFill(['queue_priority_at' => $keyAt]);
                } elseif (! $keyAt->equalTo($item->queueKey())) {
                    // A tie broken to keep the new order is a bounded same-day write on ordering only.
                    DB::table('bookings')->where('id', $item->id)->update(['queue_priority_at' => $keyAt]);
                }
                $last = $keyAt;
            }

            return ['position_before' => $before, 'position_after' => $after, 'moved_ahead_of' => $target->public_id, '__reason' => trim($reason)];
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  Closure(Booking, CarbonImmutable): array<string, mixed>  $apply  mutates the booking; returns event details
     *                                                                          (keys prefixed "__" are control values, not details)
     */
    private function run(Organization $organization, int $bookingId, User $actor, int $revision, string $key, string $operation, array $payload, Closure $apply): Booking
    {
        return DB::transaction(function () use ($organization, $bookingId, $actor, $revision, $key, $operation, $payload, $apply): Booking {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $booking = Booking::query()->where('organization_id', $locked->id)->whereKey($bookingId)->lockForUpdate()->firstOrFail();
            $hash = OperationJournal::hash($actor, $booking->id, $operation, $revision, $payload);
            if (($replay = OperationJournal::replay($locked, $actor, $key, $operation, $hash)) !== null) {
                return $replay;
            }
            if ($booking->operation_revision !== $revision) {
                throw ValidationException::withMessages(['revision' => 'This booking changed. Refresh and try again.']);
            }
            if ($booking->status !== Booking::CONFIRMED) {
                throw ValidationException::withMessages(['booking' => 'Only confirmed bookings can be operated.']);
            }

            $fromState = $booking->operational_state;
            $fromResource = $booking->claimedResourceId();
            $result = $apply($booking, CarbonImmutable::now());
            $booking->forceFill(['operation_revision' => $booking->operation_revision + 1])->save();

            $details = array_filter($result, fn (string $name): bool => ! str_starts_with($name, '__'), ARRAY_FILTER_USE_KEY);
            OperationJournal::record($locked, $actor, $booking, $operation, $fromState, $fromResource, $result['__to_resource'] ?? $booking->claimedResourceId(), $result['__reason'] ?? null, $details);
            OperationJournal::remember($locked, $actor, $booking, $key, $operation, $hash);
            BookingLifecycleChanged::for($booking);

            return $booking;
        });
    }

    /** @param  list<string>  $states */
    private function requireState(Booking $booking, array $states, string $message): void
    {
        if (! in_array($booking->operational_state, $states, true)) {
            throw ValidationException::withMessages(['booking' => $message]);
        }
    }

    private function requireToday(Booking $booking, CarbonImmutable $now, string $message): void
    {
        if (! BranchCalendar::localDate($booking->scheduled_start_at)->equalTo(BranchCalendar::localDate($now))) {
            throw ValidationException::withMessages(['booking' => $message]);
        }
    }

    /**
     * The span a not-yet-started booking still needs: its plan, or a fresh span from now when it is running late.
     *
     * @return array{CarbonImmutable, CarbonImmutable}
     */
    private function neededSpan(Booking $booking, CarbonImmutable $now): array
    {
        if ($booking->scheduled_start_at >= $now) {
            return [$booking->scheduled_start_at, $booking->occupied_end_at];
        }

        return [$now, $now->addMinutes($booking->serviceMinutes() + $booking->buffer_minutes)];
    }

    /** The nominated resource must belong to the shop, be in use and match the booking's compatible type and units. */
    private function assignableResource(Organization $organization, Booking $booking, int $resourceId): PhysicalResource
    {
        $resource = PhysicalResource::query()->where('organization_id', $organization->id)->whereKey($resourceId)->first();
        $typeUsable = $resource !== null && ResourceType::query()->where('organization_id', $organization->id)->whereKey($resource->resource_type_id)->where('is_active', true)->whereNull('archived_at')->exists();
        if ($resource === null || ! $typeUsable || ! $resource->is_active || $resource->archived_at !== null
            || $resource->resource_type_id !== $booking->resource_type_id || $resource->capacity < $booking->consumption_units) {
            throw ValidationException::withMessages(['resource_id' => 'Choose an active resource of the booked type with enough capacity.']);
        }

        return $resource;
    }
}
