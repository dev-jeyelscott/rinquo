<?php

namespace App\Modules\Identity\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Carries the raw one-time code. It is deliberately not queued: the code must
 * exist only in request memory and at the mail provider, never in a queue
 * payload or the database.
 */
final class LoginCodeMail extends Mailable
{
    /** @param  ?string  $shopName  When set, the code verifies a customer's email for a booking at that shop. */
    public function __construct(
        public readonly string $code,
        public readonly int $expiresInMinutes,
        public readonly ?string $shopName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: config('app.name').($this->shopName === null ? ' sign-in code' : ' verification code'));
    }

    public function content(): Content
    {
        $intro = $this->shopName === null
            ? 'Your '.e(config('app.name')).' sign-in code is'
            : 'Your '.e(config('app.name')).' verification code for your booking at '.e($this->shopName).' is';

        return new Content(
            htmlString: '<p>'.$intro.' <strong>'.e($this->code).'</strong>.</p>'
                .($this->shopName === null ? '' : '<p>This code signs you in to your '.e(config('app.name')).' account. Never share it with anyone, including the shop or anyone who calls or messages you.</p>')
                .'<p>It expires in '.$this->expiresInMinutes.' minutes. If you did not request it, ignore this email.</p>',
        );
    }
}
