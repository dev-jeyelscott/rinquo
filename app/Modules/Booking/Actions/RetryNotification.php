<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Jobs\RetryBookingNotification;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\NotificationFailure;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Retries one failed booking email of the route organization. The failure row
 * is the only thing a member can retry (never an arbitrary failed job), it is
 * claimed under a row lock so a double click dispatches once, and the retry is
 * audited. The booking itself is never touched.
 */
final class RetryNotification
{
    public function handle(Organization $organization, User $actor, string $failurePublicId): NotificationFailure
    {
        return DB::transaction(function () use ($organization, $actor, $failurePublicId): NotificationFailure {
            $locked = Organization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $failure = NotificationFailure::query()->where('organization_id', $locked->id)->where('public_id', $failurePublicId)->lockForUpdate()->firstOrFail();

            if ($failure->status === NotificationFailure::RETRYING) {
                return $failure;
            }
            if ($failure->status === NotificationFailure::RESOLVED) {
                throw ValidationException::withMessages(['notification' => 'This email was already delivered.']);
            }
            $addressed = Booking::query()->where('organization_id', $locked->id)->whereKey($failure->booking_id)->whereNotNull('contact_email')->exists();
            if (! $addressed) {
                throw ValidationException::withMessages(['notification' => 'This booking has no email address to retry.']);
            }

            $failure->forceFill(['status' => NotificationFailure::RETRYING, 'retry_count' => $failure->retry_count + 1, 'last_retried_at' => now(), 'last_retried_by_user_id' => $actor->id])->save();
            (new AuditTrail($locked, $actor))->record('notification.retry', 'notification_failure', $failure->id, ['status' => NotificationFailure::FAILED], ['status' => NotificationFailure::RETRYING, 'mail_type' => $failure->mail_type, 'retry_count' => $failure->retry_count]);
            RetryBookingNotification::dispatch($failure->id)->afterCommit();

            return $failure;
        });
    }
}
