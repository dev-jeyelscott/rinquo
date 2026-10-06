<?php

namespace App\Modules\Subscription\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Membership;
use Closure;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Queues subscription email to an organization's active Owners after the
 * surrounding transaction commits. A mail failure is reported and never
 * changes entitlement.
 */
final class OwnerMail
{
    /** @param  Closure(): Mailable  $mail */
    public static function queue(int $organizationId, Closure $mail): void
    {
        DB::afterCommit(function () use ($organizationId, $mail): void {
            foreach (self::addresses($organizationId) as $email) {
                try {
                    Mail::to($email)->queue($mail());
                } catch (Throwable $exception) {
                    report($exception);
                }
            }
        });
    }

    /**
     * Queues immediately and lets a failure propagate, for callers (the scheduled run) that
     * release their claim and retry on the next run.
     *
     * @param  Closure(): Mailable  $mail
     */
    public static function queueOrFail(int $organizationId, Closure $mail): void
    {
        foreach (self::addresses($organizationId) as $email) {
            Mail::to($email)->queue($mail());
        }
    }

    /** @return list<string> */
    public static function addresses(int $organizationId): array
    {
        return array_values(User::query()
            ->whereIn('id', Membership::query()->where('organization_id', $organizationId)->where('role', Membership::OWNER)->where('is_active', true)->select('user_id'))
            ->orderBy('id')
            ->pluck('email')
            ->all());
    }
}
