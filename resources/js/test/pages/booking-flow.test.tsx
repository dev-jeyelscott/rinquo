import { act, fireEvent, render, screen } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import Confirm from '@/pages/shops/book/confirm';
import Details from '@/pages/shops/book/details';
import BookingShow from '@/pages/shops/bookings/show';
import {
    bookingProps,
    confirmProps,
    detailsProps,
} from '@/test/fixtures/booking';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('Details step', () => {
    beforeEach(() => resetInertia(detailsProps));
    afterEach(() => vi.useRealTimers());

    it('asks a signed-out customer for name and email and sends a code', () => {
        render(<Details {...detailsProps} />);

        fireEvent.change(screen.getByLabelText(/Full name/), {
            target: { value: 'Ana Cruz' },
        });
        fireEvent.change(screen.getByLabelText(/Email address/), {
            target: { value: 'ana@example.test' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'put',
            url: '/shops/shine/book/holds/h1/details',
            data: { contact_name: 'Ana Cruz', email: 'ana@example.test' },
        });
        expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    });

    it('shows validation errors linked to their fields', () => {
        render(<Details {...detailsProps} />);
        inertia.nextErrors = {
            contact_name: 'The contact name field is required.',
            email: 'The email field must be a valid email address.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        const name = screen.getByLabelText(/Full name/);
        expect(name).toHaveAttribute('aria-invalid', 'true');
        expect(name).toHaveAccessibleDescription(
            'The contact name field is required.',
        );
        expect(
            screen.getByLabelText(/Email address/),
        ).toHaveAccessibleDescription(
            expect.stringContaining('valid email address'),
        );
    });

    it('does not ask a signed-in customer for an email or a code', () => {
        render(<Details {...detailsProps} signedIn />);

        expect(
            screen.queryByLabelText(/Email address/),
        ).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Full name/), {
            target: { value: 'Ana' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(inertia.calls[0].data).toEqual({
            contact_name: 'Ana',
            contact_phone: '',
            vehicle_plate: '',
            customer_vehicle_id: null,
            customer_notes: '',
        });
    });

    it('lets a signed-in customer select a saved vehicle while keeping manual entry available', () => {
        render(
            <Details
                {...detailsProps}
                signedIn
                savedVehicles={[
                    { id: 7, plate: 'RIN-007', label: 'Daily driver' },
                ]}
            />,
        );

        fireEvent.change(screen.getByLabelText(/Saved vehicle/), {
            target: { value: '7' },
        });

        expect(
            screen.getByLabelText(/Plate number or vehicle note/),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(inertia.calls[0].data).toMatchObject({ customer_vehicle_id: 7 });
    });

    it('verifies the code and waits out the resend cooldown', () => {
        vi.useFakeTimers();
        render(
            <Details
                {...detailsProps}
                verification={{
                    step: 'code',
                    email: 'ana@example.test',
                    resendInSeconds: 30,
                    codeLength: 6,
                    cooldownSeconds: 60,
                }}
                contact={{ name: 'Ana Cruz', phone: '', plate: '', notes: '' }}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeDisabled();
        expect(
            screen.getByText('You can request another code in 30 seconds.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Verify and continue' }),
        ).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/Verification code/), {
            target: { value: '12 34ab56' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and continue' }),
        );
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/shops/shine/book/holds/h1/verify',
            data: { code: '123456' },
        });

        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
        expect(inertia.calls.at(-1)).toMatchObject({
            url: '/shops/shine/book/holds/h1/code',
        });
    });

    it('shows an invalid code error beside the field and clears the entry', () => {
        render(
            <Details
                {...detailsProps}
                verification={{
                    step: 'code',
                    email: 'ana@example.test',
                    resendInSeconds: 0,
                    codeLength: 6,
                    cooldownSeconds: 60,
                }}
            />,
        );
        inertia.nextErrors = {
            code: 'That code is invalid or has expired. Request a new code.',
        };

        fireEvent.change(screen.getByLabelText(/Verification code/), {
            target: { value: '000000' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and continue' }),
        );

        expect(
            screen.getByLabelText(/Verification code/),
        ).toHaveAccessibleDescription(
            'That code is invalid or has expired. Request a new code.',
        );
        expect(screen.getByLabelText(/Verification code/)).toHaveValue('');
    });

    it('releases the time visibly when the countdown ends and offers both recoveries', () => {
        vi.useFakeTimers();
        render(
            <Details
                {...detailsProps}
                hold={{ publicId: 'h1', expiresInSeconds: 2, expired: false }}
            />,
        );

        expect(
            screen.queryByText('Your held time was released'),
        ).not.toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            screen.getByText('Your held time was released'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Choose another time' }),
        ).toHaveAttribute('href', '/shops/shine/book?vehicle=1&service=10');
        expect(
            screen.getByRole('button', { name: 'Try to keep this time' }),
        ).toBeInTheDocument();
    });
});

describe('Confirm step', () => {
    beforeEach(() => resetInertia(confirmProps));

    it('reviews everything being confirmed and posts once', () => {
        render(<Confirm {...confirmProps} />);

        expect(screen.getByText('ana@example.test')).toBeInTheDocument();
        expect(screen.getByText('Email (verified)')).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );

        expect(inertia.calls).toHaveLength(1);
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/shops/shine/book/holds/h1/confirm',
        });
    });

    it('prevents a double submit while the request is in flight', () => {
        render(<Confirm {...confirmProps} />);
        inertia.hold = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );
        const busy = screen.getByRole('button', { name: 'Confirming…' });
        fireEvent.click(busy);
        fireEvent.click(busy);

        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
        expect(inertia.calls).toHaveLength(1);
    });

    it('says it could not confirm whether the booking was created and allows a safe retry', () => {
        render(<Confirm {...confirmProps} />);
        inertia.networkFailure = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );

        expect(
            screen.getByText(
                "We couldn't confirm whether your booking was created",
            ),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(inertia.calls).toHaveLength(2);
    });

    it('keeps the selection and offers another time when the time was lost', () => {
        render(<Confirm {...confirmProps} />);
        inertia.nextErrors = {
            start_at: 'That time is no longer available. Choose another time.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );

        expect(
            screen.getByText('That time is no longer available'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Choose another time' }),
        ).toHaveAttribute('href', '/shops/shine/book?vehicle=1&service=10');
    });

    it('offers to try keeping an expired time instead of a plain confirm', () => {
        render(
            <Confirm
                {...confirmProps}
                hold={{ publicId: 'h1', expiresInSeconds: 0, expired: true }}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Try to keep this time' }),
        ).toBeInTheDocument();
    });
});

describe('Booking result page', () => {
    beforeEach(() => resetInertia(bookingProps));

    it('states what, where and when for a confirmed booking with one way forward', () => {
        render(<BookingShow {...bookingProps} />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Booking confirmed',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Full wash for your Sedan/),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(/Tue, Oct 6, 9:00 AM/).length,
        ).toBeGreaterThan(0);
        expect(screen.getByText(/1 Rizal Ave, Manila/)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Back to Shine Auto Spa' }),
        ).toHaveAttribute('href', '/shops/shine');
        // A neutral note, never a claim that the email was delivered.
        expect(
            screen.getByText('An email to ana@example.test is on its way.'),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/delivered|sent to/i),
        ).not.toBeInTheDocument();
    });

    it('shows the one open loop for a request awaiting the shop', () => {
        render(
            <BookingShow
                {...bookingProps}
                booking={{
                    ...bookingProps.booking,
                    status: 'pending_approval',
                    pendingExpiresAt: '2026-10-05T04:00:00+00:00',
                }}
            />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Request sent' }),
        ).toBeInTheDocument();
        expect(screen.getByText(/The shop will confirm by/)).toHaveTextContent(
            'Mon, Oct 5, 12:00 PM',
        );
    });

    it.each([
        ['declined', 'Request declined'],
        ['expired', 'Request expired'],
    ] as const)('states a %s request plainly', (status, title) => {
        render(
            <BookingShow
                {...bookingProps}
                booking={{ ...bookingProps.booking, status }}
            />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: title }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/is on its way/)).not.toBeInTheDocument();
    });
});
