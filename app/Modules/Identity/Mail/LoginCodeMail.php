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
    public function __construct(public readonly string $code, public readonly int $expiresInMinutes) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: config('app.name').' sign-in code');
    }

    public function content(): Content
    {
        return new Content(
            htmlString: '<p>Your '.e(config('app.name')).' sign-in code is <strong>'.e($this->code).'</strong>.</p>'
                .'<p>It expires in '.$this->expiresInMinutes.' minutes. If you did not request it, ignore this email.</p>',
        );
    }
}
