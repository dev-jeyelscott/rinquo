import { act, fireEvent, render, screen } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import Login from '@/pages/owner/auth/login';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const base = {
    email: null,
    resendInSeconds: 0,
    codeLength: 6,
    cooldownSeconds: 60,
};

describe('Owner login', () => {
    beforeEach(() => resetInertia());
    afterEach(() => vi.useRealTimers());

    it('asks for an email, labelled, and shows the server validation error', () => {
        render(<Login {...base} step="email" />);
        inertia.nextErrors = {
            email: 'The email field must be a valid email address.',
        };

        const field = screen.getByLabelText(/email address/i);
        fireEvent.change(field, { target: { value: 'nope' } });
        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/owner/auth/code',
            data: { email: 'nope' },
        });
        expect(
            screen.getByText('The email field must be a valid email address.'),
        ).toBeInTheDocument();
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription(
            'The email field must be a valid email address.',
        );
    });

    it('disables the submit button and announces progress while the request is in flight', () => {
        render(<Login {...base} step="email" />);
        inertia.hold = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Email me a code' }),
        );

        const busy = screen.getByRole('button', { name: 'Sending code...' });
        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
    });

    it('shows the code step with the address the code was sent to', () => {
        render(<Login {...base} step="code" email="owner@example.test" />);

        expect(screen.getByText(/owner@example.test/)).toBeInTheDocument();
        expect(screen.getByLabelText(/sign-in code/i)).toHaveAttribute(
            'autocomplete',
            'one-time-code',
        );
    });

    it('only enables verification for a full six-digit code and strips non-digits', () => {
        render(<Login {...base} step="code" email="owner@example.test" />);
        const verify = screen.getByRole('button', {
            name: 'Verify and sign in',
        });
        const input = screen.getByLabelText(/sign-in code/i);

        expect(verify).toBeDisabled();
        fireEvent.change(input, { target: { value: '12ab34' } });
        expect(input).toHaveValue('1234');
        expect(verify).toBeDisabled();

        fireEvent.change(input, { target: { value: '123456' } });
        expect(verify).toBeEnabled();
        fireEvent.click(verify);
        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/auth/verify',
            data: { code: '123456' },
        });
    });

    it('shows an invalid or expired code error and clears the entered code', () => {
        render(<Login {...base} step="code" email="owner@example.test" />);
        inertia.nextErrors = {
            code: 'That code is invalid or has expired. Request a new code.',
        };

        fireEvent.change(screen.getByLabelText(/sign-in code/i), {
            target: { value: '000000' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and sign in' }),
        );

        expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
        expect(screen.getByLabelText(/sign-in code/i)).toHaveValue('');
    });

    it('keeps resend disabled during the cooldown, announces the countdown and then enables it', () => {
        vi.useFakeTimers();
        render(
            <Login
                {...base}
                step="code"
                email="owner@example.test"
                resendInSeconds={2}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('in 2 seconds');

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeEnabled();
        expect(screen.getByRole('status')).toHaveTextContent('now');

        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/auth/code',
            data: { email: 'owner@example.test' },
        });
    });

    it('shows a resend rate-limit error', () => {
        render(<Login {...base} step="code" email="owner@example.test" />);
        inertia.nextErrors = {
            email: 'Too many requests. Please try again later.',
        };

        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

        expect(
            screen.getByText('Too many requests. Please try again later.'),
        ).toBeInTheDocument();
    });
});
