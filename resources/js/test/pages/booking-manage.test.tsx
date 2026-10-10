import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { wallTimeToInstant } from '@/lib/booking-format';
import BookingShow from '@/pages/shops/bookings/show';
import { bookingProps, T0900, T0915, T0930 } from '@/test/fixtures/booking';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('wallTimeToInstant', () => {
    const original = process.env.TZ;
    afterEach(() => {
        process.env.TZ = original;
    });

    it.each(['America/Los_Angeles', 'Asia/Manila', 'UTC', 'Pacific/Auckland'])(
        'reads wall time in the branch zone whatever the browser zone is (%s)',
        (browserZone) => {
            process.env.TZ = browserZone;

            expect(wallTimeToInstant('2026-10-10T10:00', 'Asia/Manila')).toBe(
                '2026-10-10T02:00:00.000Z',
            );
        },
    );

    it('honours a zone with daylight saving and rejects empty input', () => {
        expect(wallTimeToInstant('2026-07-01T09:30', 'America/New_York')).toBe(
            '2026-07-01T13:30:00.000Z',
        );
        expect(wallTimeToInstant('', 'Asia/Manila')).toBe('');
    });
});

const chip = (name: string) => screen.getByRole('radio', { name });

function openReschedule() {
    fireEvent.click(
        screen.getByRole('button', { name: 'Choose another time' }),
    );
}

function chooseAndReview(time = '9:30 AM') {
    fireEvent.click(chip(time));
    fireEvent.click(screen.getByRole('button', { name: /Review new time/ }));
}

function openAndReview(time = '9:30 AM') {
    openReschedule();
    chooseAndReview(time);
}

function openCancel() {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
}

describe('Booking detail manage controls', () => {
    beforeEach(() => resetInertia(bookingProps, '/shops/shine/bookings/b1'));

    it('keeps the approved outcome on top and a choice, not open forms, below it', () => {
        render(<BookingShow {...bookingProps} />);

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Booking confirmed',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /Manage booking/ }),
        ).toHaveAttribute('href', '#manage-booking');
        expect(
            screen.getByRole('heading', { name: 'Manage your appointment' }),
        ).toBeInTheDocument();
        expect(screen.getByText("You're all set")).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'What would you like to do?' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Choose another time' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Stay informed')).toBeInTheDocument();
        // Neither action is open until chosen.
        expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Choose a new time' }),
        ).not.toBeInTheDocument();
    });

    it('shows the booking summary with a status badge, and the change deadline when known', () => {
        const withDeadline = {
            ...bookingProps,
            booking: {
                ...bookingProps.booking,
                actions: {
                    ...bookingProps.booking.actions,
                    deadlineAt: '2026-10-05T23:00:00+00:00',
                },
            },
        };
        render(<BookingShow {...withDeadline} />);

        const summary = screen.getByRole('region', { name: 'Your booking' });
        expect(summary).toHaveTextContent('Confirmed');
        expect(summary).toHaveTextContent('Ana Cruz');
        expect(summary).toHaveTextContent('Sedan · Toyota Vios');
        expect(summary).toHaveTextContent('9:00 AM');
        expect(
            screen.getByText(
                /Changes are available until Tuesday, October 6 at 7:00 AM\. After that, contact the shop\./,
            ),
        ).toBeInTheDocument();
    });

    it('opens reschedule as its own view with a three-stage indicator and leaves it without changing anything', () => {
        render(<BookingShow {...bookingProps} />);

        openReschedule();

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Reschedule booking',
            }),
        ).toBeInTheDocument();
        const steps = screen.getByRole('navigation', {
            name: 'Reschedule steps',
        });
        expect(steps).toHaveTextContent('Choose a time');
        expect(steps).toHaveTextContent('Review change');
        expect(steps).toHaveTextContent('Done');
        expect(
            screen.getByRole('heading', { name: 'Choose a new time' }),
        ).toHaveFocus();
        expect(
            screen.getByText('Your original appointment is safe'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Your booking' }),
        ).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(
            screen.getByRole('heading', { name: 'Manage your appointment' }),
        ).toHaveFocus();
        expect(inertia.calls).toHaveLength(0);
    });

    it('selects a server-offered time without changing anything, then reviews before the one request', () => {
        render(<BookingShow {...bookingProps} />);
        openReschedule();
        const review = screen.getByRole('button', { name: /Review new time/ });
        expect(review).toHaveAttribute('aria-disabled', 'true');
        expect(review).toHaveAccessibleDescription(
            'Choose a start time first.',
        );
        fireEvent.click(review);
        // Activating the inactive button says why, and does not advance.
        expect(
            screen.getAllByText('Choose a start time first.').length,
        ).toBeGreaterThan(1);
        expect(
            screen.queryByRole('heading', { name: /Review your new/ }),
        ).not.toBeInTheDocument();
        // A time the server did not offer stays visible but cannot be chosen.
        expect(chip('9:15 AM, unavailable')).toBeDisabled();

        chooseAndReview();

        expect(inertia.calls.filter((c) => c.method === 'post')).toHaveLength(
            0,
        );
        expect(
            screen.getByRole('heading', {
                name: 'Review your new appointment',
            }),
        ).toHaveFocus();
        expect(screen.getByText('Current appointment')).toBeInTheDocument();
        expect(screen.getByText('Requested replacement')).toBeInTheDocument();
        expect(
            screen.getByText('Your current time is protected'),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );
        const post = inertia.calls.find((call) =>
            call.url.endsWith('/reschedule'),
        );
        expect(post?.data).toMatchObject({
            start_at: '2026-10-06T01:30:00+00:00',
            revision: 1,
        });
    });

    it('goes back to the selection and keeps the chosen time', () => {
        render(<BookingShow {...bookingProps} />);
        openAndReview();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(chip('9:30 AM')).toBeChecked();
    });

    it('returns to the selection with the reason and a fresh day when the server refuses the time', () => {
        render(<BookingShow {...bookingProps} />);
        openAndReview();
        inertia.nextErrors = { start_at: 'That time is no longer available.' };

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('That time is no longer available.');
        expect(alert).toHaveFocus();
        expect(
            screen.getByRole('heading', { name: 'Choose a new time' }),
        ).toBeInTheDocument();
        expect(chip('9:30 AM')).not.toBeChecked();
        const reload = inertia.calls.find((call) => call.method === 'get');
        expect(reload?.options).toMatchObject({
            only: ['replacementAvailability', 'replacementNext'],
        });
    });

    it('does not post while offline and says nothing changed', () => {
        render(<BookingShow {...bookingProps} />);
        openAndReview();
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });

        expect(
            screen.getByText('You appear to be offline'),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );

        expect(inertia.calls.filter((c) => c.method === 'post')).toHaveLength(
            0,
        );
        vi.restoreAllMocks();
    });

    it('says the booking was not changed after a network failure and lets the customer retry', () => {
        render(<BookingShow {...bookingProps} />);
        openAndReview();
        inertia.networkFailure = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Your booking was not changed',
        );
    });

    it('asks the server for the chosen date and names a failed load with a retry', () => {
        render(<BookingShow {...bookingProps} />);
        openReschedule();
        inertia.nextGet = 'error';

        fireEvent.click(screen.getByRole('radio', { name: 'Wed, Oct 7' }));

        const get = inertia.calls.find((call) => call.method === 'get');
        expect(get).toMatchObject({
            url: '/shops/shine/bookings/b1',
            data: { date: '2026-10-07' },
            options: {
                only: ['replacementAvailability', 'replacementNext'],
            },
        });
        expect(
            screen.getByText(/We couldn't load times for/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been reserved/),
        ).toBeInTheDocument();

        inertia.nextGet = 'success';
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(
            screen.queryByText(/We couldn't load times for/),
        ).not.toBeInTheDocument();
    });

    it('never shows the previous day times under a newly selected day while it loads', () => {
        render(<BookingShow {...bookingProps} />);
        openReschedule();
        expect(chip('9:30 AM')).toBeInTheDocument();
        inertia.nextGet = 'pending';

        fireEvent.click(screen.getByRole('radio', { name: 'Wed, Oct 7' }));

        expect(screen.queryByRole('radio', { name: '9:30 AM' })).toBeNull();
    });

    it('opens on a deep-linked date the server already answered for', () => {
        const deepLinked = {
            ...bookingProps,
            replacementAvailability: {
                date: '2026-10-07',
                closed: false,
                times: [
                    { startAt: '2026-10-07T01:00:00+00:00', available: true },
                ],
            },
        };
        resetInertia(deepLinked, '/shops/shine/bookings/b1?date=2026-10-07');
        render(<BookingShow {...deepLinked} />);
        openReschedule();

        expect(screen.getByRole('radio', { name: 'Wed, Oct 7' })).toBeChecked();
        expect(inertia.calls.filter((c) => c.method === 'get')).toHaveLength(0);
    });

    it('states that nothing has been reserved while offline and keeps the time list honest', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        render(<BookingShow {...bookingProps} />);
        openReschedule();

        expect(
            screen.getByText('You appear to be offline'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been reserved/),
        ).toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('drops a chosen time that a later reload no longer offers and says so', () => {
        const { rerender } = render(<BookingShow {...bookingProps} />);
        openReschedule();
        fireEvent.click(chip('9:30 AM'));

        const taken = {
            ...bookingProps,
            replacementAvailability: {
                ...bookingProps.replacementAvailability!,
                times: [
                    { startAt: T0900, available: true },
                    { startAt: T0915, available: false },
                    { startAt: T0930, available: false },
                ],
            },
        };
        rerender(<BookingShow {...taken} />);

        expect(
            screen.getByText(/no longer available. Choose another/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Review new time/ }),
        ).toHaveAttribute('aria-disabled', 'true');
    });

    it('rotates the keys, returns to the outcome and focuses its heading when the page moves to another booking, so a second reschedule is a new request', () => {
        const { rerender } = render(<BookingShow {...bookingProps} />);
        openAndReview();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );
        const first = inertia.calls.find((call) =>
            call.url.endsWith('/reschedule'),
        );
        inertia.calls = [];

        // The replacement is a different booking that starts at the same revision.
        const next = {
            ...bookingProps,
            booking: { ...bookingProps.booking, publicId: 'b2' },
            urls: {
                ...bookingProps.urls,
                booking: '/shops/shine/bookings/b2',
                reschedule: '/shops/shine/bookings/b2/reschedule',
            },
        };
        resetInertia(next, '/shops/shine/bookings/b2');
        rerender(<BookingShow {...next} />);

        // The result is announced: focus is on its heading, not on a reschedule step heading.
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Booking confirmed',
            }),
        ).toHaveFocus();
        expect(
            screen.queryByRole('heading', { name: 'Choose a new time' }),
        ).not.toBeInTheDocument();

        openReschedule();
        expect(chip('9:30 AM')).not.toBeChecked();
        chooseAndReview('9:00 AM');
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );
        const second = inertia.calls.find((call) =>
            call.url.endsWith('/b2/reschedule'),
        );

        expect(second).toBeDefined();
        expect(second?.data.idempotency_key).not.toBe(
            first?.data.idempotency_key,
        );
        expect(second?.data).toMatchObject({
            revision: 1,
            start_at: '2026-10-06T01:00:00+00:00',
        });
    });

    it('shows and announces a rejected idempotency key, then retries with a new key', () => {
        render(<BookingShow {...bookingProps} />);
        openAndReview();
        inertia.nextErrors = {
            idempotency_key:
                'This request key was already used for a different booking action.',
        };
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );
        const first = inertia.calls.find((call) =>
            call.url.endsWith('/reschedule'),
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('already used');
        expect(alert).toHaveFocus();

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm new time' }),
        );
        const second = inertia.calls.filter((call) =>
            call.url.endsWith('/reschedule'),
        )[1];
        expect(second.data.idempotency_key).not.toBe(
            first?.data.idempotency_key,
        );
    });

    it('keeps the chosen time when only the revision changes', () => {
        const { rerender } = render(<BookingShow {...bookingProps} />);
        openReschedule();
        fireEvent.click(chip('9:30 AM'));

        rerender(
            <BookingShow
                {...bookingProps}
                booking={{ ...bookingProps.booking, revision: 2 }}
            />,
        );

        expect(chip('9:30 AM')).toBeChecked();
    });

    it('keeps the typed reason when only the revision changes', () => {
        const { rerender } = render(<BookingShow {...bookingProps} />);
        openCancel();
        fireEvent.change(screen.getByLabelText(/Reason/), {
            target: { value: 'Travelling' },
        });

        rerender(
            <BookingShow
                {...bookingProps}
                booking={{ ...bookingProps.booking, revision: 2 }}
            />,
        );

        expect(screen.getByLabelText(/Reason/)).toHaveValue('Travelling');
    });

    it('opens cancellation as its own view with a policy note and leaves it with Keep booking', () => {
        render(<BookingShow {...bookingProps} />);

        openCancel();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Cancel booking' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Cancel this booking?' }),
        ).toHaveFocus();
        expect(
            screen.getByText(/Cancellation cannot be undone/),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/Reason for cancelling/)).toHaveClass(
            'border-muted-foreground',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

        expect(
            screen.getByRole('heading', { name: 'Manage your appointment' }),
        ).toHaveFocus();
        expect(inertia.calls).toHaveLength(0);
    });

    it('reviews the cancellation in a dialog that names what is cancelled and keeps the booking until it succeeds', () => {
        render(<BookingShow {...bookingProps} />);
        openCancel();

        fireEvent.click(
            screen.getByRole('button', { name: 'Review cancellation' }),
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Cancel this booking?',
        });
        expect(dialog).toHaveTextContent('Tuesday, October 6 at 9:00 AM');
        expect(dialog).toHaveTextContent('This cannot be undone');
        expect(dialog).toHaveTextContent(
            'Your booking stays as it is until then',
        );
        expect(
            within(dialog).getByRole('button', { name: 'Keep booking' }),
        ).toHaveClass('max-sm:h-11');
        expect(inertia.calls).toHaveLength(0);
    });

    it('states that the deadline has passed and offers only the shop', () => {
        const closed = {
            ...bookingProps,
            booking: {
                ...bookingProps.booking,
                actions: {
                    canCancel: false,
                    canReschedule: false,
                    reason: 'The change deadline has passed.',
                    rescheduleReason: null,
                    deadlineAt: null,
                    closedAt: '2026-10-06T00:00:00+00:00',
                    restricted: false,
                },
            },
        };
        resetInertia(closed, '/shops/shine/bookings/b1');
        render(<BookingShow {...closed} />);

        expect(
            screen.getByText('The change deadline has passed'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Self-service cancellation and rescheduling closed at 8:00 AM, 1 h before this appointment.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Need to make a change?' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Contact the shop' }),
        ).toHaveAttribute('href', 'tel:+63212345678');
        expect(
            screen.queryByRole('button', { name: 'Cancel booking' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Choose another time' }),
        ).not.toBeInTheDocument();
    });
});

describe('Booking detail cutoff without a published phone', () => {
    it('offers Back to shop only, never an empty contact action', () => {
        const closed = {
            ...bookingProps,
            branch: { ...bookingProps.branch, phone: null },
            booking: {
                ...bookingProps.booking,
                actions: {
                    ...bookingProps.booking.actions,
                    canCancel: false,
                    canReschedule: false,
                    closedAt: '2026-10-06T00:00:00+00:00',
                },
            },
        };
        resetInertia(closed, '/shops/shine/bookings/b1');
        render(<BookingShow {...closed} />);

        expect(
            screen.getByRole('link', { name: 'Back to shop' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Contact the shop' }),
        ).not.toBeInTheDocument();
    });
});

describe('Booking detail operational progress and history', () => {
    const base = bookingProps.booking;
    const props = (booking: Partial<typeof base>) => ({
        ...bookingProps,
        booking: {
            ...base,
            actions: {
                canCancel: false,
                canReschedule: false,
                reason: 'This booking can no longer be changed.',
                rescheduleReason: null,
                deadlineAt: null,
                closedAt: null,
                restricted: false,
            },
            ...booking,
        },
    });

    it('shows labelled progress while service is under way, with no mutation actions', () => {
        const page = props({
            progress: {
                state: 'in_service',
                delayed: false,
                delayMinutes: 0,
                checkedInAt: T0900,
                startedAt: T0915,
                completedAt: null,
                projectedEndAt: T0930,
            },
            history: [
                { kind: 'confirmed', at: T0900 },
                { kind: 'checked_in', at: T0900 },
                { kind: 'in_service', at: T0915 },
            ],
        });
        resetInertia(page, '/shops/shine/bookings/b1');
        render(<BookingShow {...page} />);

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Service in progress',
            }),
        ).toBeInTheDocument();
        const progress = screen.getByRole('region', {
            name: 'Booking progress',
        });
        expect(within(progress).getByText(/Checked in/)).toHaveTextContent(
            'done',
        );
        expect(within(progress).getByText(/In service/)).toHaveTextContent(
            'current',
        );
        expect(within(progress).getByText(/Completed/)).toHaveTextContent(
            'upcoming',
        );
        expect(
            screen.queryByRole('button', { name: 'Cancel booking' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Reschedule booking' }),
        ).not.toBeInTheDocument();
    });

    it('labels a derived delay in words, not only colour', () => {
        const page = props({
            progress: {
                state: 'checked_in',
                delayed: true,
                delayMinutes: 12,
                checkedInAt: T0900,
                startedAt: null,
                completedAt: null,
                projectedEndAt: null,
            },
        });
        resetInertia(page, '/shops/shine/bookings/b1');
        render(<BookingShow {...page} />);

        expect(screen.getByText('Delayed.')).toBeInTheDocument();
        expect(
            screen.getByText(/about 12 min longer to start/),
        ).toBeInTheDocument();
    });

    it('shows a completed booking as a historical record without internal detail', () => {
        const page = props({
            progress: {
                state: 'completed',
                delayed: false,
                delayMinutes: 0,
                checkedInAt: T0900,
                startedAt: T0915,
                completedAt: T0930,
                projectedEndAt: null,
            },
            history: [
                { kind: 'confirmed', at: T0900 },
                { kind: 'checked_in', at: T0900 },
                { kind: 'in_service', at: T0915 },
                { kind: 'completed', at: T0930 },
            ],
        });
        resetInertia(page, '/shops/shine/bookings/b1');
        const { container } = render(<BookingShow {...page} />);

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Service completed',
            }),
        ).toBeInTheDocument();
        const history = screen.getByRole('region', {
            name: 'Appointment history',
        });
        expect(within(history).getAllByRole('listitem')).toHaveLength(4);
        expect(history).toHaveTextContent('historical record');
        expect(
            screen.getByRole('link', { name: /Back to/ }),
        ).toBeInTheDocument();
        expect(container).not.toHaveTextContent(
            /bay|capacity|resource|buffer/i,
        );
    });

    it('links a moved booking to its replacement and the replacement to where it came from', () => {
        const moved = {
            ...props({
                status: 'rescheduled',
                rescheduledTo: { publicId: 'b2', startAt: T0930 },
                history: [
                    { kind: 'confirmed', at: T0900 },
                    { kind: 'rescheduled', at: T0915 },
                ],
            }),
        };
        moved.urls = {
            ...moved.urls,
            rescheduledTo: '/shops/shine/bookings/b2',
        };
        resetInertia(moved, '/shops/shine/bookings/b1');
        const { unmount } = render(<BookingShow {...moved} />);
        expect(
            screen.getByRole('link', { name: 'View your new booking' }),
        ).toHaveAttribute('href', '/shops/shine/bookings/b2');
        unmount();

        const replacement = props({
            publicId: 'b2',
            rescheduledFrom: { publicId: 'b1', startAt: T0900 },
        });
        replacement.urls = {
            ...replacement.urls,
            rescheduledFrom: '/shops/shine/bookings/b1',
        };
        resetInertia(replacement, '/shops/shine/bookings/b2');
        render(<BookingShow {...replacement} />);
        expect(screen.getByText(/Moved from/)).toBeInTheDocument();
    });
});

describe('Booking detail replacement proposal', () => {
    const proposal = {
        id: 'p1',
        revision: 2,
        startAt: '2026-10-06T07:00:00+00:00',
        expiresAt: '2026-10-06T06:00:00+00:00',
    };
    const withProposal = {
        ...bookingProps,
        booking: {
            ...bookingProps.booking,
            proposal,
            actions: {
                ...bookingProps.booking.actions,
                canReschedule: false,
                rescheduleReason:
                    'The shop proposed a new time. Accept or decline it first.',
            },
        },
    };

    beforeEach(() => resetInertia(withProposal, '/shops/shine/bookings/b1'));

    it('reviews the proposal as the Spec 03 comparison, without the generic management card', () => {
        render(<BookingShow {...withProposal} />);

        expect(
            screen.getByRole('heading', { name: 'Proposed new time' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('The shop suggested a new appointment time'),
        ).toBeInTheDocument();
        const card = screen.getByRole('region', {
            name: 'Review proposed time',
        });
        expect(card).toHaveTextContent('Response needed');
        expect(card).toHaveTextContent('Current appointment');
        expect(card).toHaveTextContent('Tue, Oct 6 · 9:00 AM');
        expect(card).toHaveTextContent('Confirmed and still reserved');
        expect(card).toHaveTextContent('Requested replacement');
        expect(card).toHaveTextContent('Tue, Oct 6 · 3:00 PM');
        expect(card).toHaveTextContent(
            /Respond by .* Philippine time\.|about to expire/,
        );
        expect(
            screen.getByText(/Declining keeps the existing appointment/),
        ).toBeInTheDocument();
        // No management card, cancel or reschedule beside the decision, and no staff detail leaks.
        expect(
            screen.queryByRole('heading', { name: 'Manage your appointment' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Cancel booking' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Reschedule unavailable' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Booking confirmed' }),
        ).not.toBeInTheDocument();
        expect(card).not.toHaveTextContent(/bay|capacity|resource/i);
        // The review heading takes focus when the page opens on the proposal.
        expect(card.querySelector('h2')).toHaveFocus();
    });

    it('accepts only after an explicit confirmation, with the proposal revision', () => {
        render(<BookingShow {...withProposal} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Accept new time' }),
        );
        expect(inertia.calls).toHaveLength(0);
        const dialog = screen.getByRole('dialog', {
            name: 'Accept the new time?',
        });
        expect(dialog).toHaveTextContent(
            'Move your appointment from Tuesday, October 6 at 9:00 AM to Tuesday, October 6 at 3:00 PM.',
        );
        expect(dialog).toHaveTextContent('Your booking stays protected');
        expect(dialog).toHaveTextContent(
            'We will secure the replacement before releasing your original appointment. If acceptance fails, the original stays reserved.',
        );
        expect(dialog).not.toHaveTextContent('is released');
        // Keep original first, Accept new time last (reading and tab order), 44 px on small screens.
        const buttons = within(dialog)
            .getAllByRole('button')
            .filter((button) => button.textContent !== 'Close');
        expect(buttons.map((button) => button.textContent)).toEqual([
            'Keep original',
            'Accept new time',
        ]);
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Accept new time' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/shops/shine/bookings/b1/proposal/accept',
            data: { proposal: 'p1', revision: 2 },
        });
        expect(inertia.calls[0].data.idempotency_key).toMatch(/[0-9a-f-]{36}/);
    });

    it('keeping the original closes the dialog without a request', () => {
        render(<BookingShow {...withProposal} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Accept new time' }),
        );
        const dialog = screen.getByRole('dialog', {
            name: 'Accept the new time?',
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Keep original' }),
        );

        expect(inertia.calls).toHaveLength(0);
    });

    it.each([
        [
            'Keep original',
            (dialog: HTMLElement) =>
                fireEvent.click(
                    within(dialog).getByRole('button', {
                        name: 'Keep original',
                    }),
                ),
        ],
        [
            'Close',
            (dialog: HTMLElement) =>
                fireEvent.click(
                    within(dialog).getByRole('button', { name: 'Close' }),
                ),
        ],
        [
            'Escape',
            (dialog: HTMLElement) =>
                fireEvent.keyDown(dialog, { key: 'Escape' }),
        ],
    ])(
        'returns focus to the Accept new time opener after %s',
        async (_name, dismiss) => {
            render(<BookingShow {...withProposal} />);

            const opener = screen.getByRole('button', {
                name: 'Accept new time',
            });
            opener.focus();
            fireEvent.click(opener);
            dismiss(
                screen.getByRole('dialog', { name: 'Accept the new time?' }),
            );

            await waitFor(() => expect(opener).toHaveFocus());
            expect(inertia.calls).toHaveLength(0);
        },
    );

    it('titles the document after the proposal heading', () => {
        render(<BookingShow {...withProposal} />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Proposed new time',
            }),
        ).toBeInTheDocument();
        expect(document.title).toBe('Proposed new time');
    });

    it('declines without changing the booking', () => {
        render(<BookingShow {...withProposal} />);

        fireEvent.click(
            screen.getByRole('button', { name: /Keep my original time/ }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/shops/shine/bookings/b1/proposal/decline',
            data: { proposal: 'p1', revision: 2 },
        });
    });

    it('shows why an answer was not accepted', () => {
        render(<BookingShow {...withProposal} />);
        inertia.nextErrors = {
            proposal:
                'This proposal expired. Your original time is still reserved.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: /Keep my original time/ }),
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            'This proposal expired',
        );
    });
});
