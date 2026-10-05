<?php

namespace App\Modules\Booking\Support;

use App\Modules\Booking\Actions\ManageBooking;
use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Staff read model for scheduling conflicts. Every query is organization-scoped
 * and bounded. Unresolved conflicts come first (soonest appointment first, so
 * the most urgent is on top); recently resolved ones, including same-time
 * reassignments, follow as history. The selected conflict also carries
 * currently available replacement times computed by the same availability and
 * occupancy authority the proposal action re-checks.
 */
final class ConflictBoard
{
    private const UNRESOLVED_LIMIT = 100;

    private const RECENT_LIMIT = 20;

    private const RECENT_DAYS = 14;

    private const CANDIDATE_DAYS = 7;

    private const CANDIDATE_LIMIT = 12;

    public function __construct(
        private readonly AvailabilitySearch $search,
        private readonly BookingIntake $intake,
        private readonly ManageBooking $lifecycle,
    ) {}

    public static function unresolvedCount(Organization $organization): int
    {
        return SchedulingConflict::query()->where('organization_id', $organization->id)->where('status', '!=', SchedulingConflict::RESOLVED)->count();
    }

    /** @return array<string, mixed> */
    public function build(Organization $organization, CarbonImmutable $now, ?string $selectedId): array
    {
        $unresolved = SchedulingConflict::query()->where('scheduling_conflicts.organization_id', $organization->id)->where('scheduling_conflicts.status', '!=', SchedulingConflict::RESOLVED)
            ->join('bookings', 'bookings.id', '=', 'scheduling_conflicts.booking_id')->orderBy('bookings.scheduled_start_at')->orderBy('scheduling_conflicts.id')
            ->select('scheduling_conflicts.*')->limit(self::UNRESOLVED_LIMIT)->get();
        $recent = SchedulingConflict::query()->where('organization_id', $organization->id)->where('status', SchedulingConflict::RESOLVED)
            ->where('resolved_at', '>=', $now->subDays(self::RECENT_DAYS))->orderByDesc('resolved_at')->orderByDesc('id')->limit(self::RECENT_LIMIT)->get();

        $conflicts = $unresolved->concat($recent);
        $bookings = Booking::query()->where('organization_id', $organization->id)->whereIn('id', $conflicts->pluck('booking_id'))->get()->keyBy('id');
        $proposals = ConflictProposal::query()->where('organization_id', $organization->id)->whereIn('conflict_id', $conflicts->pluck('id'))->orderByDesc('id')->get()->groupBy('conflict_id');
        $resources = PhysicalResource::query()->where('organization_id', $organization->id)->pluck('name', 'id');

        $rows = fn (Collection $set): array => $set->map(fn (SchedulingConflict $conflict): array => $this->row($conflict, $bookings->get($conflict->booking_id), $proposals->get($conflict->id) ?? collect(), $resources, $now))->values()->all();

        // Default to the most urgent unresolved conflict so the workspace is never empty while work remains.
        $selected = $selectedId === null ? $unresolved->first() : $conflicts->firstWhere('public_id', $selectedId);

        return [
            'now' => $now->utc()->toIso8601String(),
            'timezone' => 'Asia/Manila',
            'counts' => [
                'needsProposal' => $unresolved->where('status', SchedulingConflict::OPEN)->count(),
                'awaitingCustomer' => $unresolved->where('status', SchedulingConflict::AWAITING_CUSTOMER)->count(),
                'reassigned' => $recent->where('resolution', SchedulingConflict::SAME_TIME_REASSIGNED)->count(),
            ],
            'unresolved' => $rows($unresolved),
            'recent' => $rows($recent),
            'selectedId' => $selected?->public_id,
            'candidates' => $selected !== null && $selected->isUnresolved() ? $this->candidates($organization, $selected, $bookings->get($selected->booking_id), $now) : null,
        ];
    }

    /**
     * @param  Collection<int, ConflictProposal>  $proposals  newest first
     * @param  Collection<int, string>  $resources
     * @return array<string, mixed>
     */
    private function row(SchedulingConflict $conflict, ?Booking $booking, Collection $proposals, Collection $resources, CarbonImmutable $now): array
    {
        $active = $proposals->first(fn (ConflictProposal $proposal): bool => $proposal->status === ConflictProposal::ACTIVE);
        $last = $active === null ? $proposals->first() : null;
        $canPropose = $conflict->isUnresolved() && $booking !== null && $booking->customer_user_id !== null && $booking->isLive();

        return [
            'id' => $conflict->public_id,
            'status' => $conflict->status,
            'resolution' => $conflict->resolution,
            'cause' => $conflict->cause,
            'source' => $conflict->source,
            'detectedAt' => $conflict->detected_at->utc()->toIso8601String(),
            'resolvedAt' => $conflict->resolved_at?->utc()->toIso8601String(),
            'revision' => $conflict->revision,
            'originalResource' => $resources[$conflict->original_resource_id] ?? null,
            'reassignedResource' => $conflict->reassigned_resource_id === null ? null : ($resources[$conflict->reassigned_resource_id] ?? null),
            'booking' => $booking === null ? null : [
                'id' => $booking->public_id,
                'customerName' => $booking->contact_name,
                'customerPhone' => $booking->contact_phone,
                'hasAccount' => $booking->customer_user_id !== null,
                'serviceName' => $booking->service_name,
                'vehicleName' => $booking->vehicle_type_name,
                'status' => $booking->status,
                'startAt' => $booking->scheduled_start_at->utc()->toIso8601String(),
                'serviceEndAt' => $booking->service_end_at->utc()->toIso8601String(),
                'durationMinutes' => $booking->serviceMinutes(),
                'bufferMinutes' => $booking->buffer_minutes,
            ],
            'proposal' => $active === null ? null : [
                'id' => $active->public_id,
                'startAt' => $active->proposed_start_at->utc()->toIso8601String(),
                'expiresAt' => $active->expires_at->utc()->toIso8601String(),
                'resource' => $resources[$active->physical_resource_id] ?? null,
                'lapsed' => $active->expires_at <= $now,
            ],
            'lastOutcome' => $last === null ? null : [
                'status' => $last->status,
                'startAt' => $last->proposed_start_at->utc()->toIso8601String(),
                'respondedAt' => $last->responded_at?->utc()->toIso8601String(),
            ],
            'actions' => [
                'propose' => $canPropose,
                'withdraw' => $conflict->isUnresolved() && $active !== null,
            ],
        ];
    }

    /**
     * Replacement times that are available right now for this booking's own
     * snapshot terms, with the resource that would hold them (staff only).
     *
     * @return array{times: list<array{startAt: string, resource: string}>, error: ?string}
     */
    private function candidates(Organization $organization, SchedulingConflict $conflict, ?Booking $booking, CarbonImmutable $now): array
    {
        if ($booking === null || $booking->customer_user_id === null || ! $booking->isLive()) {
            return ['times' => [], 'error' => null];
        }

        try {
            $addOnIds = array_values(BookingAddOn::query()->where('booking_id', $booking->id)->pluck('add_on_id')->map(fn ($id): int => (int) $id)->all());
            $offer = $this->intake->resolveOfferForVariant($organization, $booking->service_vehicle_variant_id, $addOnIds);
        } catch (ValidationException) {
            return ['times' => [], 'error' => 'This service can no longer be offered, so there is no time to propose.'];
        }

        [$variant, $addOns] = $this->lifecycle->snapshotTerms($booking, $offer->variant, $offer->addOns);
        $policy = $organization->bookingPolicy()->firstOrFail();
        $today = BranchCalendar::localDate($now);
        $times = [];
        for ($offset = 0; $offset < min(self::CANDIDATE_DAYS, $policy->horizon_days + 1) && count($times) < self::CANDIDATE_LIMIT; $offset++) {
            $day = $this->search->forDate($organization, $policy, $variant, $addOns, $today->addDays($offset), $now);
            foreach ($day->times as $time) {
                $start = CarbonImmutable::parse($time['startAt']);
                if (! $time['available'] || $start->equalTo($booking->scheduled_start_at) || $start >= $booking->scheduled_start_at->addDays(self::CANDIDATE_DAYS)) {
                    continue;
                }
                $assignment = $this->search->feasibleClaim($organization, $variant, $addOns, $start, $now);
                if ($assignment !== null) {
                    $times[] = ['startAt' => $start->utc()->toIso8601String(), 'resource' => $assignment->resource->name];
                }
                if (count($times) >= self::CANDIDATE_LIMIT) {
                    break;
                }
            }
        }

        return ['times' => $times, 'error' => null];
    }
}
