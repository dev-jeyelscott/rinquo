<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Mail\Mailables\Content;

/**
 * Sent only when staff send a reschedule proposal (never on detection). It
 * states that the original time is still reserved, names the proposed time and
 * the response deadline, and links to the owner-only booking page where the
 * customer accepts or declines. Rendered from the booking's active proposal.
 */
final class SchedulingProposalMail extends BookingMailable
{
    protected function subjectLine(Organization $organization, Booking $booking): string
    {
        return $organization->name.' proposed a new time for your booking';
    }

    protected function lead(Organization $organization, Booking $booking): string
    {
        return $organization->name.' cannot serve your booking at its original time and proposed another. Your original time stays reserved until you accept.';
    }

    public function content(): Content
    {
        $booking = Booking::query()->findOrFail($this->bookingId);
        $organization = Organization::query()->findOrFail($booking->organization_id);
        $proposal = ConflictProposal::query()->where('booking_id', $booking->id)->where('status', ConflictProposal::ACTIVE)->latest('id')->first();
        $format = 'D, M j, Y \a\t g:i A';
        $original = $booking->scheduled_start_at->setTimezone($booking->branch_timezone)->format($format);

        $rows = ['Your current time (still reserved)' => $original];
        if ($proposal !== null) {
            $rows['Proposed time'] = $proposal->proposed_start_at->setTimezone($booking->branch_timezone)->format($format);
            $rows['Please respond by'] = $proposal->expires_at->setTimezone($booking->branch_timezone)->format($format);
        }
        $table = '';
        foreach ($rows as $label => $value) {
            $table .= '<tr><td style="padding:2px 12px 2px 0;color:#555">'.e($label).'</td><td><strong>'.e($value).'</strong></td></tr>';
        }
        $link = '<p><a href="'.e(route('bookings.show', [$organization->slug, $booking->public_id])).'">Review and respond</a></p>';

        return new Content(htmlString: '<p>'.e($this->lead($organization, $booking)).'</p><table>'.$table.'</table>'
            .'<p>If you decline or do not respond in time, nothing changes and the shop will contact you.</p>'.$link.'<p>'.e($organization->name).'</p>');
    }
}
