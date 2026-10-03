import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { RealtimeConfig } from '@/types/realtime';

/**
 * Connects the browser to Reverb once per page load using the runtime
 * configuration shared through Inertia props (not build-time variables).
 */
export function connectEcho(config: RealtimeConfig): Echo<'reverb'> {
    if (window.Echo) {
        return window.Echo;
    }

    const echo = new Echo({
        broadcaster: 'reverb',
        key: config.key,
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: config.scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        Pusher,
    });

    window.Echo = echo;

    return echo;
}
