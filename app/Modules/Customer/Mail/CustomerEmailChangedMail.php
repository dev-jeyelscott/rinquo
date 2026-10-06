<?php

namespace App\Modules\Customer\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CustomerEmailChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $newEmail) {}

    public function build(): self
    {
        return $this->subject('Your Rinquo email address changed')
            ->text('mail.customer-email-changed');
    }
}
