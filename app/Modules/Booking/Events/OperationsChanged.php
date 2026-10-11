<?php

namespace App\Modules\Booking\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Something the Operations board shows changed (a booking, a block, a
 * notification failure). Like {@see BookingLifecycleChanged} it is only a
 * nudge: sent after the transaction commits on the organization's private
 * channel (active Owner and Staff of that organization only) with an empty
 * payload. Clients refetch the server-authoritative board; the event itself is
 * never rendered.
 */
final class OperationsChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public readonly int $organizationId) {}

    public static function for(int $organizationId): void
    {
        self::dispatch($organizationId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('operations.'.$this->organizationId);
    }

    public function broadcastAs(): string
    {
        return 'operations.changed';
    }

    /** @return array<string, never> */
    public function broadcastWith(): array
    {
        return [];
    }
}
