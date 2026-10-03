<?php

namespace App\Support\Diagnostics;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Sent synchronously to Reverb on the public diagnostics channel. Carries
 * only a random token, so it is safe on a public channel.
 */
final class FoundationSmokeBroadcast implements ShouldBroadcastNow
{
    public const CHANNEL = 'system.smoke';

    public function __construct(public readonly string $token) {}

    public function broadcastOn(): Channel
    {
        return new Channel(self::CHANNEL);
    }

    public function broadcastAs(): string
    {
        return 'foundation.smoke';
    }

    /**
     * @return array{token: string}
     */
    public function broadcastWith(): array
    {
        return ['token' => $this->token];
    }
}
