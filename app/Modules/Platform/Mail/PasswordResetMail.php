<?php

namespace App\Modules\Platform\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Carries a reset link. Never queued: the token must not sit in a queue payload. */
final class PasswordResetMail extends Mailable
{
    public function __construct(public readonly string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: config('app.name').' platform password reset');
    }

    public function content(): Content
    {
        return new Content(htmlString: '<p>A password reset was requested for your '.e(config('app.name')).' platform account.</p>'
            .'<p><a href="'.e($this->url).'">Choose a new password</a>. The link expires in 60 minutes. Resetting your password does not replace your second factor. If you did not request it, ignore this email.</p>');
    }
}
