<?php

namespace App\Modules\Booking\Jobs;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\NotificationFailure;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

/**
 * Re-sends exactly one recorded failed booking email once, synchronously inside
 * the job so the outcome is known: it resolves the failure on success and
 * reopens it (still retryable) when delivery fails again. It never retries on
 * its own, so a retry cannot silently multiply.
 */
final class RetryBookingNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $failureId) {}

    public function handle(): void
    {
        $failure = NotificationFailure::query()->find($this->failureId);
        if ($failure === null || $failure->status !== NotificationFailure::RETRYING) {
            return;
        }
        $email = Booking::query()->where('organization_id', $failure->organization_id)->whereKey($failure->booking_id)->value('contact_email');
        if ($email === null) {
            $this->reopen('MissingRecipient');

            return;
        }

        Mail::to($email)->sendNow($failure->mailable());
        $failure->forceFill(['status' => NotificationFailure::RESOLVED, 'resolved_at' => now()])->save();
    }

    public function failed(Throwable $exception): void
    {
        $this->reopen($exception::class);
    }

    private function reopen(string $errorClass): void
    {
        NotificationFailure::query()->whereKey($this->failureId)->where('status', NotificationFailure::RETRYING)
            ->update(['status' => NotificationFailure::FAILED, 'error_class' => Str::limit($errorClass, 160, ''), 'failed_at' => now(), 'updated_at' => now()]);
    }
}
