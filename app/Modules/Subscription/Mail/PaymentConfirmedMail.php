<?php

namespace App\Modules\Subscription\Mail;

use App\Modules\Subscription\Models\Payment;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent once a provider-confirmed payment has extended access. */
final class PaymentConfirmedMail extends SubscriptionMailable
{
    public function __construct(public readonly int $paymentId)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Payment received: access extended');
    }

    public function content(): Content
    {
        $payment = Payment::query()->findOrFail($this->paymentId);
        $organization = Organization::query()->findOrFail($payment->organization_id);

        return new Content(htmlString: '<p>We received your payment of <strong>'.e(self::money($payment->amount_centavos)).'</strong> for '.e($organization->name).'.</p>'
            .'<p>Access is now paid through <strong>'.e(self::date($payment->paid_until)).'</strong>.</p>'
            .'<p><a href="'.e(route('owner.settings.billing', $organization)).'">View billing</a></p>');
    }
}
