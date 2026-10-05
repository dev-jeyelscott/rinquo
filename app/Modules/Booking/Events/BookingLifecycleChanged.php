<?php

namespace App\Modules\Booking\Events;

use App\Modules\Booking\Models\Booking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A booking's lifecycle changed. It is only a nudge: it is sent after the
 * transaction commits, on the booking's private channel (the owning customer
 * is the only authorized subscriber), and carries no customer data. Clients
 * react by refetching the server-authoritative booking, never by trusting this
 * payload.
 */
final class BookingLifecycleChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public readonly string $bookingPublicId) {}

    public static function for(Booking $booking): void
    {
        self::dispatch($booking->public_id);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('booking.'.$this->bookingPublicId);
    }

    public function broadcastAs(): string
    {
        return 'booking.lifecycle.changed';
    }

    /** @return array<string, never> */
    public function broadcastWith(): array
    {
        return [];
    }
}
