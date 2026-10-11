<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Register authorization callbacks for private and presence channels here.
| Public channels (such as the "system.smoke" diagnostics channel) need no
| registration. Domain channels are added by the slices that own them.
|
*/

// A booking's lifecycle channel: only the customer who owns the booking.
Broadcast::channel('booking.{publicId}', fn (User $user, string $publicId): bool => Booking::query()
    ->where('public_id', $publicId)
    ->where('customer_user_id', $user->id)
    ->exists());

// The Operations board of one organization: only its active Owner and Staff.
Broadcast::channel('operations.{organizationId}', fn (User $user, string $organizationId): bool => ctype_digit($organizationId) && Membership::query()
    ->where('organization_id', (int) $organizationId)
    ->where('user_id', $user->id)
    ->where('is_active', true)
    ->exists());
