<?php

namespace App\Modules\Subscription\Mail;

use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Reminds the Owner that paid or trial access ends on a named date. */
final class RenewalReminderMail extends SubscriptionMailable
{
    public function __construct(public readonly int $organizationId, public readonly string $endsAtIso, public readonly int $offsetDays)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        $days = $this->offsetDays === 1 ? '1 day' : $this->offsetDays.' days';

        return new Envelope(subject: "Your Rinquo access ends in {$days}");
    }

    public function content(): Content
    {
        $organization = Organization::query()->findOrFail($this->organizationId);

        return new Content(htmlString: '<p>Access for <strong>'.e($organization->name).'</strong> ends on <strong>'.e(self::date(CarbonImmutable::parse($this->endsAtIso))).'</strong>.</p>'
            .'<p>After that there is a short grace period, then the shop stops taking new bookings. Existing bookings are never affected, and nothing is deleted.</p>'
            .'<p><a href="'.e(route('owner.settings.billing', $organization)).'">Renew with a QR Ph payment</a></p>');
    }
}
