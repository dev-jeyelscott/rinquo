<?php

namespace App\Modules\Booking\Models;

use App\Modules\Booking\Mail\BookingApprovedMail;
use App\Modules\Booking\Mail\BookingCompletedMail;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Mail\BookingDeclinedMail;
use App\Modules\Booking\Mail\BookingMailable;
use App\Modules\Booking\Mail\BookingNoShowMail;
use App\Modules\Booking\Mail\BookingReminderMail;
use App\Modules\Booking\Mail\BookingRequestExpiredMail;
use App\Modules\Booking\Mail\BookingRequestReceivedMail;
use App\Modules\Booking\Mail\SchedulingProposalMail;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Throwable;

/**
 * A booking email that permanently failed. It is tenant-scoped and keeps only
 * the exception class (never a message that could carry an address), so the
 * dashboard can show it and a member can retry exactly that mail once.
 *
 * @property int $id
 * @property int $organization_id
 * @property string $public_id
 * @property int $booking_id
 * @property string $mail_type
 * @property string $status
 * @property string $error_class
 * @property int $retry_count
 * @property CarbonImmutable $failed_at
 */
class NotificationFailure extends Model
{
    public const FAILED = 'failed';

    public const RETRYING = 'retrying';

    public const RESOLVED = 'resolved';

    /** The only mailables that can be recorded and retried, keyed by mail type. */
    private const MAILABLES = [
        'booking_confirmed' => BookingConfirmedMail::class,
        'booking_request_received' => BookingRequestReceivedMail::class,
        'booking_approved' => BookingApprovedMail::class,
        'booking_declined' => BookingDeclinedMail::class,
        'booking_request_expired' => BookingRequestExpiredMail::class,
        'booking_reminder' => BookingReminderMail::class,
        'booking_completed' => BookingCompletedMail::class,
        'booking_no_show' => BookingNoShowMail::class,
        'scheduling_proposal' => SchedulingProposalMail::class,
    ];

    protected $table = 'operational_notification_failures';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'failed_at' => 'immutable_datetime',
            'last_retried_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public static function typeOf(BookingMailable $mailable): ?string
    {
        $type = array_search($mailable::class, self::MAILABLES, true);

        return $type === false ? null : $type;
    }

    /** Records (or reopens) the failure of one booking mail, idempotently per booking and mail type. */
    public static function record(BookingMailable $mailable, Throwable $exception): ?self
    {
        $type = self::typeOf($mailable);
        $organizationId = Booking::query()->whereKey($mailable->bookingId)->value('organization_id');
        if ($type === null || $organizationId === null) {
            return null;
        }

        $failure = self::query()->firstOrNew(['organization_id' => $organizationId, 'booking_id' => $mailable->bookingId, 'mail_type' => $type]);
        if (! $failure->exists) {
            $failure->public_id = (string) Str::uuid();
        }
        $failure->forceFill(['status' => self::FAILED, 'error_class' => Str::limit($exception::class, 160, ''), 'failed_at' => now(), 'resolved_at' => null])->save();

        return $failure;
    }

    public function mailable(): BookingMailable
    {
        $class = self::MAILABLES[$this->mail_type];

        return new $class($this->booking_id);
    }

    public function label(): string
    {
        return match ($this->mail_type) {
            'booking_confirmed' => 'Booking confirmation',
            'booking_request_received' => 'Request received',
            'booking_approved' => 'Request approved',
            'booking_declined' => 'Request declined',
            'booking_request_expired' => 'Request expired',
            'booking_reminder' => 'Booking reminder',
            'booking_completed' => 'Service complete',
            'booking_no_show' => 'Missed appointment',
            'scheduling_proposal' => 'New time proposal',
            default => 'Booking email',
        };
    }
}
