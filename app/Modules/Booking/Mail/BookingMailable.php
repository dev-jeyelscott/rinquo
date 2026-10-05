<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Base of every booking email. It carries only the booking id and renders from
 * the immutable snapshot, with times in the branch timezone. Mail is queued
 * after the booking transaction commits and retried with backoff; a failure
 * here never changes the booking.
 */
abstract class BookingMailable extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    public function __construct(public readonly int $bookingId)
    {
        $this->afterCommit();
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    abstract protected function subjectLine(Organization $organization, Booking $booking): string;

    /** The lead sentence under the greeting. */
    abstract protected function lead(Organization $organization, Booking $booking): string;

    public function envelope(): Envelope
    {
        [$organization, $booking] = $this->records();

        return new Envelope(subject: $this->subjectLine($organization, $booking));
    }

    public function content(): Content
    {
        [$organization, $booking] = $this->records();

        $start = $booking->scheduled_start_at->setTimezone($booking->branch_timezone);
        $rows = [
            'Service' => $booking->service_name,
            'Vehicle' => $booking->vehicle_type_name,
            'Add-ons' => $booking->addOns->isEmpty() ? 'None' : $booking->addOns->pluck('name')->implode(', '),
            'When' => $start->format('D, M j, Y \a\t g:i A').' (Philippine time)',
            'Total' => '₱'.number_format($booking->total_price_centavos / 100, $booking->total_price_centavos % 100 === 0 ? 0 : 2),
        ];

        $table = '';
        foreach ($rows as $label => $value) {
            $table .= '<tr><td style="padding:2px 12px 2px 0;color:#555">'.e($label).'</td><td><strong>'.e($value).'</strong></td></tr>';
        }

        return new Content(
            htmlString: '<p>'.e($this->lead($organization, $booking)).'</p>'
                .'<table>'.$table.'</table>'
                .'<p><a href="'.e(route('bookings.show', [$organization->slug, $booking->public_id])).'">View your booking</a></p>'
                .'<p>'.e($organization->name).'</p>',
        );
    }

    /** @return array{Organization, Booking} */
    private function records(): array
    {
        $booking = Booking::query()->with('addOns')->findOrFail($this->bookingId);

        return [Organization::query()->findOrFail($booking->organization_id), $booking];
    }
}
