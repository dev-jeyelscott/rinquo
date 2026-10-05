import { fireEvent, render, screen } from '@testing-library/react';
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
