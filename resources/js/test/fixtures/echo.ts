import { vi } from 'vite-plus/test';

type StateHandler = (change: { current: string; previous: string }) => void;

/**
 * A stand-in for Echo + Reverb exposing the private channel and the connection
 * state machine, installed as `window.Echo`. `emit` delivers a channel event by
 * its dotted name; `transition` moves the socket between states.
 */
export function fakeEcho(initial = 'connected') {
    const handlers: Record<string, () => void> = {};
    const state = { value: initial, onState: null as StateHandler | null };
    const channel = {
        listen: vi.fn((event: string, cb: () => void) => {
            handlers[event] = cb;

            return channel;
        }),
        error: vi.fn(() => channel),
    };
    const echo = {
        private: vi.fn(() => channel),
        leave: vi.fn(),
        connector: {
            pusher: {
                connection: {
                    get state() {
                        return state.value;
                    },
                    bind: vi.fn((_: string, cb: StateHandler) => {
                        state.onState = cb;
                    }),
                    unbind: vi.fn(),
                },
            },
        },
    };
    window.Echo = echo as unknown as typeof window.Echo;

    return {
        echo,
        channel,
        emit: (event: string) => handlers[event]?.(),
        transition: (current: string, previous: string) => {
            state.value = current;
            state.onState?.({ current, previous });
        },
    };
}
