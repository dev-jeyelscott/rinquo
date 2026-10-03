<?php

namespace App\Support\Diagnostics;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Plain infrastructure smoke message. Contains no user or business data.
 */
final class FoundationSmokeMail extends Mailable
{
    public function __construct(public readonly string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: config('app.name').' mail smoke test');
    }

    public function content(): Content
    {
        return new Content(
            htmlString: '<p>Mail delivery smoke test. Reference: '.e($this->token).'</p>',
        );
    }
}
