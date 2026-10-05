<?php

namespace App\Modules\Booking\Availability;

use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Branch;
use Carbon\CarbonImmutable;

/**
 * The branch-local calendar for one service: opening intervals (a date override
 * replaces that date's weekly hours) and the service's weekly windows. It turns
 * a local date into candidate start instants. Branch-local wall-clock values
 * are interpreted in Asia/Manila (no DST) and converted to UTC instants.
 */
final class BranchCalendar
{
    /**
     * @param  array<int, list<array{int, int}>>  $weekly  open intervals (minutes) by ISO weekday
     * @param  array<string, list<array{int, int}>>  $overrides  open intervals by local date (empty list = closed)
     * @param  array<int, list<array{int, int}>>  $windows  service windows (minutes) by ISO weekday
     */
    public function __construct(
        private readonly array $weekly,
        private readonly array $overrides,
        private readonly array $windows,
    ) {}

    public static function load(int $organizationId, int $serviceId, CarbonImmutable $from, CarbonImmutable $to): self
    {
        $weekly = [];
        foreach (BranchWeeklyHour::query()->where('organization_id', $organizationId)->get() as $row) {
            $weekly[$row->weekday][] = [ReadinessEvaluator::minutes($row->opens_at), ReadinessEvaluator::minutes($row->closes_at)];
        }

        $overrides = [];
        $overrideRows = BranchDateOverride::query()
            ->where('organization_id', $organizationId)
            ->whereBetween('local_date', [$from->toDateString(), $to->toDateString()])
            ->get();
        foreach ($overrideRows as $row) {
            $overrides[$row->local_date->toDateString()] = $row->is_closed
                ? []
                : [[ReadinessEvaluator::minutes((string) $row->opens_at), ReadinessEvaluator::minutes((string) $row->closes_at)]];
        }

        $windows = [];
        foreach (ServiceWindow::query()->where('organization_id', $organizationId)->where('service_id', $serviceId)->get() as $row) {
            $windows[$row->weekday][] = [ReadinessEvaluator::minutes($row->starts_at), ReadinessEvaluator::minutes($row->ends_at)];
        }

        return new self($weekly, $overrides, $windows);
    }

    /** The local calendar date (midnight, Asia/Manila) of an instant. */
    public static function localDate(CarbonImmutable $instant): CarbonImmutable
    {
        return $instant->setTimezone(Branch::TIMEZONE)->startOfDay();
    }

    /** @return list<array{int, int}> */
    public function openIntervals(CarbonImmutable $localDate): array
    {
        return $this->overrides[$localDate->toDateString()] ?? $this->weekly[$localDate->dayOfWeekIso] ?? [];
    }

    public function isClosed(CarbonImmutable $localDate): bool
    {
        return $this->openIntervals($localDate) === [];
    }

    /**
     * Candidate start instants (UTC) on a local date for a span of
     * $spanMinutes. The service span (not the trailing buffer) must lie inside
     * one service window intersected with an opening interval, starts sit on
     * the policy grid anchored at local midnight, and the start respects the
     * minimum notice and the booking horizon. $now is the reference instant.
     *
     * @return list<CarbonImmutable>
     */
    public function starts(CarbonImmutable $localDate, int $spanMinutes, BookingPolicy $policy, CarbonImmutable $now): array
    {
        $today = self::localDate($now);
        $lastDate = $today->addDays($policy->horizon_days);

        if ($localDate < $today || $localDate > $lastDate || $spanMinutes <= 0) {
            return [];
        }

        $earliest = $now->addMinutes($policy->min_notice_minutes);
        $open = $this->openIntervals($localDate);
        $step = $policy->slot_interval_minutes;
        $minutes = [];

        foreach ($this->windows[$localDate->dayOfWeekIso] ?? [] as [$windowStart, $windowEnd]) {
            foreach ($open as [$opens, $closes]) {
                $low = max($windowStart, $opens);
                $high = min($windowEnd, $closes);

                $first = (int) (ceil($low / $step) * $step);
                for ($minute = $first; $minute + $spanMinutes <= $high; $minute += $step) {
                    $minutes[$minute] = true;
                }
            }
        }

        ksort($minutes);

        $starts = [];
        foreach (array_keys($minutes) as $minute) {
            $start = $localDate->addMinutes($minute)->utc();
            if ($start >= $earliest) {
                $starts[] = $start;
            }
        }

        return $starts;
    }
}
