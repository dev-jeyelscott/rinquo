<?php

namespace App\Modules\Platform\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A security notification that names the event only, never a credential or code. */
final class SecurityNoticeMail extends Mailable
{
    public function __construct(public readonly string $summary) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: config('app.name').' platform security notice');
    }

    public function content(): Content
    {
        return new Content(htmlString: '<p>'.e($this->summary).'</p><p>If this was not you, contact another platform administrator immediately.</p>');
    }
}
