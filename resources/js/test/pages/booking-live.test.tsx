import { act, fireEvent, render, screen } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import BookingShow from '@/pages/shops/bookings/show';
import { bookingProps } from '@/test/fixtures/booking';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

type StateHandler = (change: { current: string; previous: string }) => void;

/** A stand-in for Echo + Reverb that exposes the channel and connection hooks. */
function fakeEcho(initial = 'connected') {
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
        emit: () => handlers['.booking.lifecycle.changed']?.(),
        transition: (current: string, previous: string) => {
            state.value = current;
            state.onState?.({ current, previous });
        },
    };
}

describe('Booking detail live updates', () => {
    beforeEach(() => {
        resetInertia(bookingProps, '/shops/shine/bookings/b1');
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        delete window.Echo;
    });

    it('subscribes to its private channel and says live updates are on', () => {
        const live = fakeEcho();
        const { unmount } = render(<BookingShow {...bookingProps} />);

        expect(live.echo.private).toHaveBeenCalledWith('booking.b1');
        expect(screen.getByText('Live updates on.')).toBeInTheDocument();

        unmount();
        expect(live.echo.leave).toHaveBeenCalledWith('booking.b1');
    });

    it('refetches only the authoritative booking when an event arrives', () => {
        const live = fakeEcho();
        inertia.getReply = {
            booking: {
                ...bookingProps.booking,
                status: 'cancelled',
                revision: 2,
                actions: {
                    ...bookingProps.booking.actions,
                    canCancel: false,
                    canReschedule: false,
                    reason: 'This booking can no longer be changed.',
                },
            },
        };
        const { rerender } = render(<BookingShow {...bookingProps} />);

        act(() => live.emit());
        rerender(<BookingShow {...(inertia.props as typeof bookingProps)} />);

        const get = inertia.calls.find((call) => call.method === 'get');
        expect(get).toMatchObject({
            url: '/shops/shine/bookings/b1',
            options: { only: ['booking', 'urls'], preserveState: true },
        });
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Booking cancelled',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Updated just now. Live updates on.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('This booking can no longer be changed.'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Cancel booking' }),
        ).not.toBeInTheDocument();
    });

    it('shows a loading state only when the refresh is slow', () => {
        const live = fakeEcho();
        inertia.nextGet = 'pending';
        render(<BookingShow {...bookingProps} />);

        act(() => live.emit());
        expect(screen.queryByText('Updating booking…')).not.toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(screen.getByText('Updating booking…')).toBeInTheDocument();
    });

    it('coalesces events that arrive while a refresh is running', () => {
        const live = fakeEcho();
        inertia.nextGet = 'pending';
        render(<BookingShow {...bookingProps} />);

        act(() => {
            live.emit();
            live.emit();
            live.emit();
        });

        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('explains a failed refresh and retries on request', () => {
        const live = fakeEcho();
        inertia.nextGet = 'network';
        render(<BookingShow {...bookingProps} />);

        act(() => live.emit());
        expect(
            screen.getByText('We could not load the latest details'),
        ).toBeInTheDocument();
        expect(
            document.querySelector('[aria-live="assertive"]'),
        ).toHaveTextContent('Could not load the latest booking details');

        inertia.nextGet = 'success';
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(
            document.querySelector('[role="status"][tabindex="-1"]'),
        ).toHaveFocus();

        expect(
            screen.queryByText('We could not load the latest details'),
        ).not.toBeInTheDocument();
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(2);
    });

    it('says updates are paused when disconnected and catches up after reconnecting', () => {
        const live = fakeEcho();
        render(<BookingShow {...bookingProps} />);

        act(() => live.transition('unavailable', 'connected'));
        expect(screen.getByText('Live updates are paused')).toBeInTheDocument();
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);

        act(() => live.transition('connected', 'unavailable'));
        expect(
            screen.queryByText('Live updates are paused'),
        ).not.toBeInTheDocument();
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('catches up on the real connected, connecting, connected sequence of a short outage', () => {
        const live = fakeEcho();
        render(<BookingShow {...bookingProps} />);

        act(() => live.transition('connecting', 'connected'));
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);
        act(() => live.transition('connected', 'connecting'));

        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('does not refetch on the first connect', () => {
        const live = fakeEcho('connecting');
        render(<BookingShow {...bookingProps} />);

        act(() => live.transition('connected', 'connecting'));

        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);
    });

    it('keeps one persistent polite region and announces pause and refresh outcomes in it', () => {
        const live = fakeEcho();
        render(<BookingShow {...bookingProps} />);
        const region = document.querySelector(
            '[role="status"][tabindex="-1"]',
        ) as HTMLElement;
        expect(region).toHaveTextContent('');

        act(() => live.transition('unavailable', 'connected'));
        expect(document.querySelector('[role="status"][tabindex="-1"]')).toBe(
            region,
        );
        expect(region).toHaveTextContent('Live updates are paused');
        expect(screen.queryAllByRole('alert')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
        expect(region).toHaveFocus();
        expect(region).toHaveTextContent('Booking details updated.');
        expect(
            screen.getByText('Updated just now. Live updates are paused.'),
        ).toBeInTheDocument();
    });

    it('is paused with a manual refresh when no realtime connection exists', () => {
        render(<BookingShow {...bookingProps} />);

        expect(screen.getByText('Live updates are paused')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('treats a rejected subscription as disconnected', () => {
        const live = fakeEcho();
        render(<BookingShow {...bookingProps} />);
        const onError = (
            live.channel.error.mock.calls as unknown as [() => void][]
        )[0][0];

        act(() => onError());

        expect(screen.getByText('Live updates are paused')).toBeInTheDocument();
    });

    it('reloads when the change deadline passes so the controls close', () => {
        fakeEcho();
        const deadlineAt = new Date(Date.now() + 60_000).toISOString();
        const props = {
            ...bookingProps,
            booking: {
                ...bookingProps.booking,
                actions: { ...bookingProps.booking.actions, deadlineAt },
            },
        };
        resetInertia(props, '/shops/shine/bookings/b1');
        render(<BookingShow {...props} />);

        act(() => {
            vi.advanceTimersByTime(61_000);
        });

        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('recovers from a revision conflict by loading the latest booking', () => {
        fakeEcho();
        render(<BookingShow {...bookingProps} />);
        inertia.nextErrors = {
            revision: 'This booking changed. Refresh and try again.',
        };

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Cancel booking' })[0],
        );
        fireEvent.click(
            screen.getAllByRole('button', { name: 'Cancel booking' }).at(-1)!,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'This booking changed',
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Load latest details' }),
        );

        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
        expect(inertia.calls.some((call) => call.method === 'get')).toBe(true);
        expect(
            screen.queryByText('Load latest details'),
        ).not.toBeInTheDocument();
    });

    it('submits the reloaded revision with a fresh idempotency key', () => {
        const live = fakeEcho();
        inertia.getReply = {
            booking: { ...bookingProps.booking, revision: 3 },
        };
        const { rerender } = render(<BookingShow {...bookingProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
        fireEvent.click(
            screen.getAllByRole('button', { name: 'Cancel booking' }).at(-1)!,
        );
        const first = inertia.calls.find((call) => call.method === 'post');
        fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
        inertia.calls = [];

        act(() => live.emit());
        rerender(<BookingShow {...(inertia.props as typeof bookingProps)} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
        fireEvent.click(
            screen.getAllByRole('button', { name: 'Cancel booking' }).at(-1)!,
        );

        const post = inertia.calls.find((call) => call.method === 'post');
        expect(first?.data).toMatchObject({ revision: 1 });
        expect(post?.data).toMatchObject({ revision: 3 });
        expect(post?.data.idempotency_key).not.toBe(
            first?.data.idempotency_key,
        );
    });

    it('states the restricted-shop and cutoff limits plainly', () => {
        fakeEcho();
        const restricted = {
            ...bookingProps,
            booking: {
                ...bookingProps.booking,
                actions: {
                    ...bookingProps.booking.actions,
                    canReschedule: false,
                    rescheduleReason:
                        'Rescheduling is unavailable while this shop is not accepting new bookings. You can still cancel.',
                },
            },
        };
        resetInertia(restricted, '/x');
        render(<BookingShow {...restricted} />);

        expect(
            screen.getByText(/Rescheduling is unavailable/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Need to cancel?' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Reschedule booking' }),
        ).not.toBeInTheDocument();
    });
});
