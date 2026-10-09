import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
        fireEvent.change(screen.getByLabelText(/Vehicle make \/ model/), {
            target: { value: 'Toyota Vios' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'put',
            url: '/shops/shine/book/holds/h1/details',
            data: {
                contact_name: 'Ana Cruz',
                email: 'ana@example.test',
                vehicle_make_model: 'Toyota Vios',
            },
        });
        expect(screen.getByRole('timer')).toHaveTextContent(
            'Time held for 10:00',
        );
        expect(screen.getByRole('timer')).toHaveTextContent(
            'Your selection is temporary',
        );
    });

    it('shows validation errors linked to their fields', () => {
        render(<Details {...detailsProps} />);
        inertia.nextErrors = {
            contact_name: 'The contact name field is required.',
            email: 'The email field must be a valid email address.',
            vehicle_make_model: 'Enter your vehicle make and model.',
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
        expect(
            screen.getByLabelText(/Vehicle make \/ model/),
        ).toHaveAccessibleDescription('Enter your vehicle make and model.');
    });

    it('moves focus to the first invalid field after a failed submit and to the heading on arrival', () => {
        render(<Details {...detailsProps} />);
        expect(
            screen.getByRole('heading', { name: 'Who is this booking for?' }),
        ).toHaveFocus();
        inertia.nextErrors = {
            contact_name: 'Enter your name.',
            email: 'The email field must be a valid email address.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        expect(screen.getByLabelText(/Full name/)).toHaveFocus();
    });

    it('does not ask a signed-in customer for an email or a code', () => {
        render(
            <Details
                {...detailsProps}
                signedIn
                contact={{ ...detailsProps.contact, makeModel: 'Honda City' }}
            />,
        );

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
            vehicle_make_model: 'Honda City',
            vehicle_plate: '',
            customer_notes: '',
        });
    });

    it('lets the customer correct the make and model held with the time, and has no saved-vehicle chooser', () => {
        render(
            <Details
                {...detailsProps}
                signedIn
                contact={{ ...detailsProps.contact, makeModel: 'Honda Cty' }}
            />,
        );

        expect(
            screen.queryByLabelText(/Saved vehicle/),
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Vehicle make \/ model/)).toHaveValue(
            'Honda Cty',
        );
        fireEvent.change(screen.getByLabelText(/Vehicle make \/ model/), {
            target: { value: 'Honda City' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(inertia.calls[0].data).toMatchObject({
            vehicle_make_model: 'Honda City',
        });
    });

    it('keeps the five stages and a persistent action bar with the held time on small screens', () => {
        render(<Details {...detailsProps} />);

        expect(
            screen.getByRole('listitem', { current: 'step' }),
        ).toHaveTextContent('Details');
        const bar = screen.getByRole('group', { name: 'Booking actions' });
        expect(bar).toHaveAttribute('data-booking-action-bar');
        expect(bar).toHaveTextContent('Time held: 10:00');
        expect(bar).toContainElement(
            screen.getByRole('button', { name: 'Email me a code' }),
        );
        expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
            'href',
            '/shops/shine/book?vehicle=1&service=10',
        );
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
                contact={{
                    name: 'Ana Cruz',
                    phone: '',
                    makeModel: 'Toyota Vios',
                    plate: '',
                    notes: '',
                }}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(
            'Resend code in 00:30',
        );
        expect(
            screen.getByRole('button', { name: 'Verify and continue' }),
        ).toBeDisabled();

        // Six separate digit cells; only digits are accepted and typing advances.
        const cells = screen.getAllByLabelText(/Digit \d of 6/);
        expect(cells).toHaveLength(6);
        fireEvent.change(cells[0], { target: { value: '1' } });
        expect(cells[1]).toHaveFocus();
        fireEvent.change(cells[1], { target: { value: 'a' } });
        fireEvent.change(cells[1], { target: { value: '2' } });
        fireEvent.change(cells[2], { target: { value: '3' } });
        fireEvent.change(cells[3], { target: { value: '4' } });
        fireEvent.change(cells[4], { target: { value: '5' } });
        expect(
            screen.getByRole('button', { name: 'Verify and continue' }),
        ).toBeDisabled();
        fireEvent.change(cells[5], { target: { value: '6' } });
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

        fireEvent.paste(screen.getAllByLabelText(/Digit \d of 6/)[0], {
            clipboardData: { getData: () => '000 000' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and continue' }),
        );

        expect(
            screen.getByRole('group', { name: '6-digit verification code' }),
        ).toHaveAccessibleDescription(
            'That code is invalid or has expired. Request a new code.',
        );
        for (const cell of screen.getAllByLabelText(/Digit \d of 6/)) {
            expect(cell).toHaveValue('');
        }
        // The cleared entry restarts at the first cell, and editing drops the stale error.
        const first = screen.getAllByLabelText(/Digit \d of 6/)[0];
        expect(first).toHaveFocus();
        fireEvent.change(first, { target: { value: '1' } });
        expect(
            screen.queryByText(/That code is invalid or has expired/),
        ).not.toBeInTheDocument();
    });

    it('focuses the first cell when the verification step opens', () => {
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

        expect(screen.getAllByLabelText(/Digit \d of 6/)[0]).toHaveFocus();
    });

    it('spreads a pasted code, backspaces to the previous cell and moves with the arrow keys', () => {
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
        const cells = () => screen.getAllByLabelText(/Digit \d of 6/);

        fireEvent.paste(cells()[0], {
            clipboardData: { getData: () => '246 18' },
        });
        expect(cells().map((cell) => (cell as HTMLInputElement).value)).toEqual(
            ['2', '4', '6', '1', '8', ''],
        );
        expect(cells()[5]).toHaveFocus();

        fireEvent.keyDown(cells()[5], { key: 'Backspace' });
        expect(cells()[4]).toHaveFocus();
        expect((cells()[4] as HTMLInputElement).value).toBe('');

        fireEvent.keyDown(cells()[4], { key: 'ArrowLeft' });
        expect(cells()[3]).toHaveFocus();
        fireEvent.keyDown(cells()[3], { key: 'ArrowRight' });
        expect(cells()[4]).toHaveFocus();
        expect(
            screen.getByRole('button', { name: 'Verify and continue' }),
        ).toBeDisabled();
    });

    it('offers the edit-email path from the verification step', () => {
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

        expect(screen.getByText('ana@example.test')).toBeInTheDocument();
        expect(
            screen.getByRole('listitem', { current: 'step' }),
        ).toHaveTextContent('Details');
        fireEvent.click(
            screen.getByRole('button', {
                name: /Edit details or use a different email/,
            }),
        );
        expect(inertia.calls.at(-1)).toMatchObject({
            url: '/shops/shine/book/holds/h1/restart',
        });
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
        expect(
            within(
                screen.getByRole('region', { name: 'Booking details' }),
            ).getByText('Sedan · Toyota Vios'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Edit booking' }),
        ).toHaveAttribute('href', '/shops/shine/book?vehicle=1&service=10');
        expect(
            screen.getByRole('link', { name: 'Edit details' }),
        ).toHaveAttribute('href', '/shops/shine/book/holds/h1/details');
        // Customer-facing duration only: no buffer, capacity or resource wording.
        expect(document.body).toHaveTextContent('1 h 20 min');
        expect(document.body).not.toHaveTextContent(
            /buffer|capacity|units|resource/i,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );

        expect(inertia.calls).toHaveLength(1);
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/shops/shine/book/holds/h1/confirm',
        });
    });

    it('says it sends a request, never that it confirms, when the shop approves each booking', () => {
        render(<Confirm {...confirmProps} requestOnly />);

        expect(
            screen.queryByRole('button', { name: 'Confirm booking' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(/reviews your request before it is confirmed/),
        ).toBeInTheDocument();
        inertia.hold = true;
        fireEvent.click(
            screen.getByRole('button', { name: 'Send booking request' }),
        );

        expect(
            screen.getByRole('button', { name: 'Sending request…' }),
        ).toBeDisabled();
    });

    it('keeps the hold status beside the persistent action', () => {
        render(<Confirm {...confirmProps} />);

        const bar = screen.getByRole('group', { name: 'Booking actions' });
        expect(bar).toHaveTextContent('Time held: 10:00');
        expect(bar).toContainElement(
            screen.getByRole('button', { name: 'Confirm booking' }),
        );
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
            screen.getByRole('heading', { level: 1, name: 'Your booking' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Booking confirmed',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Your appointment is confirmed with Shine Auto Spa.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText('Full wash + Wax')).toBeInTheDocument();
        expect(screen.getByText('Sedan · Toyota Vios')).toBeInTheDocument();
        expect(
            screen.getByText('Tuesday, October 6 · 9:00 AM'),
        ).toBeInTheDocument();
        expect(screen.getByText('1 h 20 min')).toBeInTheDocument();
        expect(screen.getByText('Shine Auto Spa · Manila')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Back to shop' }),
        ).toHaveAttribute('href', '/shops/shine');
        expect(
            screen.getByRole('link', { name: 'Manage booking' }),
        ).toHaveAttribute('href', '#manage-booking');
        // Promises intent to send, never delivery, and never shows buffer or capacity.
        expect(
            screen.getByText(
                "We'll send the details by email to ana@example.test. Delivery is not guaranteed until processed.",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText(/is on its way/)).not.toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/buffer|capacity/i);
    });

    it('is a plain return to the shop when there is nothing left to manage', () => {
        render(
            <BookingShow
                {...bookingProps}
                booking={{
                    ...bookingProps.booking,
                    actions: {
                        ...bookingProps.booking.actions,
                        canCancel: false,
                        canReschedule: false,
                    },
                }}
            />,
        );

        expect(
            screen.getByRole('link', { name: 'Back to Shine Auto Spa' }),
        ).toHaveAttribute('href', '/shops/shine');
        expect(
            screen.queryByRole('link', { name: 'Manage booking' }),
        ).not.toBeInTheDocument();
    });

    it('shows the one open loop for a request awaiting the shop, without claiming confirmation', () => {
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
            screen.getByRole('heading', { level: 2, name: 'Request sent' }),
        ).toBeInTheDocument();
        expect(screen.getByText('not confirmed yet.')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Awaiting shop approval' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Shop decision by')).toBeInTheDocument();
        expect(
            screen.getByText('Monday, October 5 · 12:00 PM'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /temporarily held while Shine Auto Spa reviews it/,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Track request' }),
        ).toBeInTheDocument();
        expect(screen.queryByText('Service price')).not.toBeInTheDocument();
        expect(screen.queryByText(/is on its way/)).not.toBeInTheDocument();
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
            screen.getByRole('heading', { level: 2, name: title }),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/send the details by email/),
        ).not.toBeInTheDocument();
    });
});
