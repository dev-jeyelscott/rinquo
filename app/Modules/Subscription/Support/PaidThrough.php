<?php

namespace App\Modules\Subscription\Support;

use Carbon\CarbonImmutable;

/**
 * Paid-through arithmetic (ADR 0005). Each confirmed payment buys exactly one
 * calendar month, counted in Asia/Manila without day overflow (Jan 31 plus a
 * month is Feb 28/29), then stored as a UTC instant.
 *
 * Anchor: while the current access (trial, or paid-through, whichever ends
 * later) is still running, the new month starts where it ends; once access
 * has ended, it starts at the provider-confirmed payment time.
 */
final class PaidThrough
{
    public static function anchor(CarbonImmutable $trialEndsAt, ?CarbonImmutable $paidUntil, CarbonImmutable $paidAt): CarbonImmutable
    {
        $accessEnds = $paidUntil !== null && $paidUntil > $trialEndsAt ? $paidUntil : $trialEndsAt;

        return $paidAt < $accessEnds ? $accessEnds : $paidAt;
    }

    public static function monthAfter(CarbonImmutable $anchor): CarbonImmutable
    {
        return $anchor->setTimezone(PlanTerms::TIMEZONE)->addMonthNoOverflow()->utc();
    }

    public static function graceEnds(CarbonImmutable $paidUntil, int $graceDays): CarbonImmutable
    {
        return $paidUntil->addDays($graceDays);
    }
}
