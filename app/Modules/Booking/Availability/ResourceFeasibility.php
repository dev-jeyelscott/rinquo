<?php

namespace App\Modules\Booking\Availability;

use Carbon\CarbonImmutable;

/**
 * Pure per-resource capacity check. A claim of $units over [start, end) fits a
 * resource when, at every instant of that span, the units of the overlapping
 * live claims plus $units stay within the resource capacity. The peak is found
 * by sweeping claim start events, so non-overlapping claims never add up and a
 * peak inside the span is never missed.
 */
final class ResourceFeasibility
{
    /** @param  iterable<Claim>  $claims */
    public static function fits(int $capacity, int $units, CarbonImmutable $start, CarbonImmutable $end, iterable $claims): bool
    {
        if ($units <= 0 || $units > $capacity) {
            return false;
        }

        return self::peak($start, $end, $claims) + $units <= $capacity;
    }

    /**
     * Highest simultaneous load of the claims overlapping [start, end).
     *
     * @param  iterable<Claim>  $claims
     */
    public static function peak(CarbonImmutable $start, CarbonImmutable $end, iterable $claims): int
    {
        $overlapping = [];
        foreach ($claims as $claim) {
            if ($claim->start < $end && $claim->end > $start) {
                $overlapping[] = $claim;
            }
        }

        if ($overlapping === []) {
            return 0;
        }

        // Load only changes upward at a claim start, so those instants (and the
        // span start) are the only places the peak can occur.
        $points = [$start->getTimestamp()];
        foreach ($overlapping as $claim) {
            if ($claim->start > $start) {
                $points[] = $claim->start->getTimestamp();
            }
        }

        $peak = 0;
        foreach (array_unique($points) as $instant) {
            $load = 0;
            foreach ($overlapping as $claim) {
                if ($claim->start->getTimestamp() <= $instant && $claim->end->getTimestamp() > $instant) {
                    $load += $claim->units;
                }
            }
            $peak = max($peak, $load);
        }

        return $peak;
    }
}
