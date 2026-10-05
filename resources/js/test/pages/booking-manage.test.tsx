import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { bookingProps } from '@/test/fixtures/booking';
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

describe('Booking detail manage controls', () => {
    beforeEach(() => resetInertia(bookingProps, '/shops/shine/bookings/b1'));

    it('keeps the chosen reschedule time visible and posts the branch-zone instant', () => {
        process.env.TZ = 'America/Los_Angeles';
        render(<BookingShow {...bookingProps} />);
        const field = screen.getByLabelText(/New date and time/);
        const submit = screen.getByRole('button', {
            name: 'Check and reschedule',
        });
        expect(submit).toHaveAttribute('aria-disabled', 'true');

        fireEvent.change(field, { target: { value: '2026-10-10T10:00' } });

        expect(field).toHaveValue('2026-10-10T10:00');
        expect(submit).toHaveAttribute('aria-disabled', 'false');
        fireEvent.click(submit);
        const post = inertia.calls.find((call) =>
            call.url.endsWith('/reschedule'),
        );
        expect(post?.data).toMatchObject({
            start_at: '2026-10-10T02:00:00.000Z',
            revision: 1,
        });
    });

    it('ignores a submit with no chosen time', () => {
        render(<BookingShow {...bookingProps} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Check and reschedule' }),
        );

        expect(inertia.calls).toHaveLength(0);
    });

    it('links a reschedule error to the field and returns focus to it', () => {
        render(<BookingShow {...bookingProps} />);
        const field = screen.getByLabelText(/New date and time/);
        fireEvent.change(field, { target: { value: '2026-10-10T10:00' } });
        inertia.nextErrors = { start_at: 'That time is not available.' };

        fireEvent.click(
            screen.getByRole('button', { name: 'Check and reschedule' }),
        );

        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAttribute('aria-describedby', 'reschedule-error');
        expect(screen.getByRole('alert')).toHaveAttribute(
            'id',
            'reschedule-error',
        );
        expect(field).toHaveFocus();
    });

    it('labels the field with the branch timezone and gives fields a visible boundary', () => {
        render(<BookingShow {...bookingProps} />);

        expect(
            screen.getByLabelText(/New date and time \(Philippine time\)/),
        ).toHaveClass('border-muted-foreground');
        expect(screen.getByLabelText(/Reason/)).toHaveClass(
            'border-muted-foreground',
        );
    });

    it('keeps the typed reason and picked time when the revision changes', () => {
        const { rerender } = render(<BookingShow {...bookingProps} />);
        fireEvent.change(screen.getByLabelText(/Reason/), {
            target: { value: 'Travelling' },
        });
        fireEvent.change(screen.getByLabelText(/New date and time/), {
            target: { value: '2026-10-10T10:00' },
        });

        rerender(
            <BookingShow
                {...bookingProps}
                booking={{ ...bookingProps.booking, revision: 2 }}
            />,
        );

        expect(screen.getByLabelText(/Reason/)).toHaveValue('Travelling');
        expect(screen.getByLabelText(/New date and time/)).toHaveValue(
            '2026-10-10T10:00',
        );
    });

    it('opens the cancel dialog from its trigger and lets the small-screen keep action reach 44px', () => {
        render(<BookingShow {...bookingProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

        expect(
            screen.getByRole('button', { name: 'Keep booking' }),
        ).toHaveClass('max-sm:h-11');
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

    it('states the original is still confirmed and shows the proposed time and deadline', () => {
        render(<BookingShow {...withProposal} />);

        const card = screen.getByRole('region', {
            name: /The shop proposed a new time/,
        });
        expect(card).toHaveTextContent('still confirmed for');
        expect(card).toHaveTextContent('9:00 AM');
        expect(card).toHaveTextContent('stays reserved unless you accept');
        expect(card).toHaveTextContent('Proposed time');
        expect(card).toHaveTextContent('3:00 PM');
        expect(card).toHaveTextContent(/Please answer within|about to expire/);
        // Self-service rescheduling is not offered beside a staff proposal, and no staff detail leaks.
        expect(
            screen.queryByLabelText(/New date and time/),
        ).not.toBeInTheDocument();
        expect(card).not.toHaveTextContent(/bay|capacity|resource/i);
    });

    it('accepts only after an explicit confirmation, with the proposal revision', () => {
        render(<BookingShow {...withProposal} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Accept new time' }),
        );
        expect(inertia.calls).toHaveLength(0);
        const dialog = screen.getByRole('dialog', {
            name: 'Move your booking?',
        });
        expect(dialog).toHaveTextContent('original time is released');
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

    it('declines without changing the booking', () => {
        render(<BookingShow {...withProposal} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Keep my original time' }),
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
            screen.getByRole('button', { name: 'Keep my original time' }),
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            'This proposal expired',
        );
    });
});
