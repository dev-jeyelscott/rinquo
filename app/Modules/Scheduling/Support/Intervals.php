<?php

namespace App\Modules\Scheduling\Support;

use App\Modules\Scheduling\Readiness\ReadinessEvaluator;

/** Local wall-clock interval helpers shared by hours and service windows. */
final class Intervals
{
    /**
     * True when any two intervals on the same key overlap. Touching end/start
     * boundaries (10:00-12:00 and 12:00-14:00) do not overlap.
     *
     * @param  array<array-key, array{0: int|string, 1: string, 2: string}>  $intervals  [key, start HH:MM, end HH:MM]
     */
    public static function overlap(array $intervals): bool
    {
        $byKey = [];
        foreach ($intervals as [$key, $start, $end]) {
            $byKey[$key][] = [ReadinessEvaluator::minutes($start), ReadinessEvaluator::minutes($end)];
        }

        foreach ($byKey as $list) {
            usort($list, fn (array $a, array $b): int => $a[0] <=> $b[0]);
            for ($i = 1; $i < count($list); $i++) {
                if ($list[$i][0] < $list[$i - 1][1]) {
                    return true;
                }
            }
        }

        return false;
    }
}
