<?php

namespace App\Modules\Platform\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Carries a single-use invitation link. Never queued: the token must not sit in a queue payload. */
final class InvitationMail extends Mailable
{
    public function __construct(public readonly string $url, public readonly int $expiresInHours) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'You are invited to '.config('app.name').' platform administration');
    }

    public function content(): Content
    {
        return new Content(htmlString: '<p>You have been invited to administer '.e(config('app.name')).'.</p>'
            .'<p><a href="'.e($this->url).'">Accept the invitation</a>. It can be used once and expires in '.$this->expiresInHours.' hours. You will set a password and a second factor. If you did not expect it, ignore this email.</p>');
    }
}
