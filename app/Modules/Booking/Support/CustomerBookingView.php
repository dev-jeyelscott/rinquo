<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingLifecycleEvent;
use App\Modules\Booking\Models\ConflictProposal;
use Carbon\CarbonImmutable;

/**
 * The customer-safe read model of an owned booking. It is an explicit
 * allowlist: lifecycle status, a projection of the operational progress, the
 * customer-meaningful history and the self-service actions. It never carries
 * numeric ids, actors, staff reasons, resources, capacity, buffers, raw policy
 * or audit payloads.
 */
final class CustomerBookingView
{
    /** A projected delay beyond this many minutes is presented as "delayed". */
    public const DELAY_THRESHOLD_MINUTES = 5;

    /**
     * @param  array{canCancel: bool, canReschedule: bool, reason: ?string, deadlineAt: ?string, closedAt: ?string}  $actions
     * @return array<string, mixed>
     */
    public function present(Booking $booking, array $actions, bool $restricted, ?ConflictProposal $proposal, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();

        return [
            'publicId' => $booking->public_id,
            'status' => $booking->status,
            'serviceName' => $booking->service_name,
            'vehicleName' => $booking->vehicle_type_name,
            'vehicleMakeModel' => $booking->vehicle_make_model,
            'addOns' => $booking->addOns->map(fn ($addOn): array => ['name' => $addOn->name, 'priceCentavos' => $addOn->price_centavos])->all(),
            'totalCentavos' => $booking->total_price_centavos,
            'durationMinutes' => $booking->variant_duration_minutes + $booking->add_ons_duration_minutes,
            'startAt' => $booking->scheduled_start_at->utc()->toIso8601String(),
            'timezone' => $booking->branch_timezone,
            'pendingExpiresAt' => $booking->pending_expires_at?->utc()->toIso8601String(),
            'contactName' => $booking->contact_name,
            'contactEmail' => $booking->contact_email,
            'revision' => $booking->revision,
            'actions' => [
                ...$actions,
                'canReschedule' => $actions['canReschedule'] && ! $restricted && $proposal === null,
                // The shop is not accepting bookings or replacement times (a subscription limit): the page says so, never why.
                'restricted' => $restricted && $actions['canReschedule'],
                'rescheduleReason' => $proposal !== null
                    ? 'The shop proposed a new time. Accept or decline it first.'
                    : ($restricted && $actions['canReschedule'] ? 'This shop is not accepting new bookings or replacement times. Your existing booking remains confirmed.' : null),
            ],
            'progress' => $this->progress($booking, $now),
            'history' => $this->history($booking),
            'rescheduledFrom' => $this->linked(Booking::query()->where('organization_id', $booking->organization_id)->where('rescheduled_to_booking_id', $booking->id)->where('customer_user_id', $booking->customer_user_id)->first()),
            'rescheduledTo' => $booking->rescheduled_to_booking_id === null ? null : $this->linked(Booking::query()->where('organization_id', $booking->organization_id)->whereKey($booking->rescheduled_to_booking_id)->where('customer_user_id', $booking->customer_user_id)->first()),
            'proposal' => $proposal === null ? null : [
                'id' => $proposal->public_id,
                'revision' => $proposal->revision,
                'startAt' => $proposal->proposed_start_at->utc()->toIso8601String(),
                'expiresAt' => $proposal->expires_at->utc()->toIso8601String(),
            ],
        ];
    }

    /**
     * Operational progress as a customer may see it. Only a confirmed booking has progress; "delayed"
     * is derived (no persisted state): a checked-in customer still waiting more than the threshold
     * past the appointment time, or service whose projected end slips past the booked end.
     *
     * @return array{state: string, delayed: bool, delayMinutes: int, checkedInAt: ?string, startedAt: ?string, completedAt: ?string, projectedEndAt: ?string}|null
     */
    private function progress(Booking $booking, CarbonImmutable $now): ?array
    {
        if ($booking->status !== Booking::CONFIRMED) {
            return null;
        }
        $state = $booking->operational_state;
        $delay = match ($state) {
            Booking::CHECKED_IN => max(0, (int) floor($booking->scheduled_start_at->diffInMinutes($now, false))),
            Booking::IN_SERVICE => max(0, (int) floor($booking->service_end_at->diffInMinutes($booking->projectedServiceEnd(), false))),
            default => 0,
        };

        return [
            'state' => $state,
            'delayed' => $delay > self::DELAY_THRESHOLD_MINUTES,
            'delayMinutes' => $delay > self::DELAY_THRESHOLD_MINUTES ? $delay : 0,
            'checkedInAt' => $booking->checked_in_at?->utc()->toIso8601String(),
            'startedAt' => $booking->started_at?->utc()->toIso8601String(),
            'completedAt' => $booking->completed_at?->utc()->toIso8601String(),
            'projectedEndAt' => $state === Booking::IN_SERVICE ? $booking->projectedServiceEnd()->utc()->toIso8601String() : null,
        ];
    }

    /**
     * The customer-meaningful events, oldest first. Each is a kind and an instant: no actor, reason or assignment.
     *
     * @return list<array{kind: string, at: string}>
     */
    private function history(Booking $booking): array
    {
        $events = [];
        $add = function (string $kind, ?CarbonImmutable $at) use (&$events): void {
            if ($at !== null) {
                $events[] = ['kind' => $kind, 'at' => $at->utc()];
            }
        };

        // A request went to the shop for a decision; an instantly confirmed booking starts at "confirmed".
        $wasRequest = $booking->decided_at !== null || in_array($booking->status, [Booking::PENDING_APPROVAL, Booking::DECLINED, Booking::EXPIRED], true);
        $add('requested', $wasRequest ? CarbonImmutable::instance($booking->created_at) : null);
        $add('confirmed', $booking->confirmed_at);
        $add('declined', $booking->status === Booking::DECLINED ? $booking->decided_at : null);
        $add('expired', $booking->expired_at);
        $add('checked_in', $booking->checked_in_at);
        $add('in_service', $booking->started_at);
        $add('completed', $booking->completed_at);
        $add('no_show', $booking->no_show_at);
        foreach (BookingLifecycleEvent::query()->where('organization_id', $booking->organization_id)->where('booking_id', $booking->id)->whereIn('operation', ['cancel', 'reschedule'])->orderBy('id')->limit(10)->get() as $event) {
            $add($event->operation === 'cancel' ? 'cancelled' : 'rescheduled', CarbonImmutable::instance($event->created_at));
        }
        usort($events, fn (array $a, array $b): int => $a['at'] <=> $b['at']);

        return array_map(fn (array $event): array => ['kind' => $event['kind'], 'at' => $event['at']->toIso8601String()], $events);
    }

    /** @return array{publicId: string, startAt: string}|null */
    private function linked(?Booking $booking): ?array
    {
        return $booking === null ? null : ['publicId' => $booking->public_id, 'startAt' => $booking->scheduled_start_at->utc()->toIso8601String()];
    }
}
