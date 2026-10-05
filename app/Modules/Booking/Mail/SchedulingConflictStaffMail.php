<?php

namespace App\Modules\Booking\Mail;

use App\Modules\Tenancy\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Tells a member that bookings need scheduling attention. It carries only the
 * shop and a count (no customer data) and links to the member-only dashboard.
 */
final class SchedulingConflictStaffMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $organizationId, public readonly int $conflicts)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->conflicts === 1 ? '1 booking needs scheduling attention' : "{$this->conflicts} bookings need scheduling attention");
    }

    public function content(): Content
    {
        $organization = Organization::query()->findOrFail($this->organizationId);
        $link = route('owner.scheduling-conflicts.index', $organization);
        $noun = $this->conflicts === 1 ? 'booking can' : 'bookings can';

        return new Content(htmlString: '<p>'.e($this->conflicts.' '.$noun.' no longer be fulfilled as scheduled at '.$organization->name.'. The customers were not contacted and their original times are still reserved.').'</p>'
            .'<p><a href="'.e($link).'">Review scheduling conflicts</a></p>');
    }
}
