import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Login from '@/pages/customer/auth/login';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('Customer sign-in', () => {
    beforeEach(() =>
        resetInertia(
            { appName: 'Rinquo', flash: { status: null } },
            '/account/auth/login',
        ),
    );

    it('requests a code for the entered email with a pending guard', () => {
        render(
            <Login
                step="email"
                email={null}
                resendInSeconds={0}
                codeLength={6}
            />,
        );

        fireEvent.change(screen.getByLabelText(/Email address/), {
            target: { value: 'ana@example.test' },
        });
        inertia.hold = true;
        fireEvent.click(
            screen.getByRole('button', { name: 'Send verification code' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/account/auth/code',
            data: { email: 'ana@example.test' },
        });
        expect(
            screen.getByRole('button', { name: 'Sending code...' }),
        ).toBeDisabled();
    });

    it('verifies six digits and keeps resend behind the server cooldown', () => {
        render(
            <Login
                step="code"
                email="ana@example.test"
                resendInSeconds={42}
                codeLength={6}
            />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Check your email' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Verify code' }),
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: 'Resend code' }),
        ).toBeDisabled();
        expect(screen.getByText(/in 42 seconds/)).toBeInTheDocument();
        // The ticking countdown is plain text; the live region stays quiet until the cooldown ends.
        expect(screen.getByRole('status')).toBeEmptyDOMElement();

        fireEvent.change(
            screen.getByRole('textbox', { name: 'Digit 1 of 6' }),
            {
                target: { value: '123456' },
            },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
        expect(inertia.calls[0]).toMatchObject({
            url: '/account/auth/verify',
            data: { code: '123456' },
        });
    });

    it('announces the end of the cooldown once, not every second', () => {
        vi.useFakeTimers();
        try {
            render(
                <Login
                    step="code"
                    email="ana@example.test"
                    resendInSeconds={2}
                    codeLength={6}
                />,
            );
            expect(screen.getByRole('status')).toBeEmptyDOMElement();

            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(screen.getByRole('status')).toBeEmptyDOMElement();

            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(screen.getByRole('status')).toHaveTextContent(
                'You can request another code now.',
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it('focuses the email field and uses the 3:1 control border when submit is rejected', () => {
        render(
            <Login
                step="email"
                email={null}
                resendInSeconds={0}
                codeLength={6}
            />,
        );
        const field = screen.getByLabelText(/Email address/);
        expect(field).toHaveClass('border-booking-control');

        inertia.nextErrors = { email: 'The email field is required.' };
        fireEvent.click(
            screen.getByRole('button', { name: 'Send verification code' }),
        );

        expect(field).toHaveFocus();
        expect(field).toHaveAccessibleDescription(
            'The email field is required.',
        );
    });

    it('resends through the existing code request and shows a refused send truthfully', () => {
        render(
            <Login
                step="code"
                email="ana@example.test"
                resendInSeconds={0}
                codeLength={6}
            />,
        );

        inertia.nextErrors = {
            email: 'We could not send the code. Please try again.',
        };
        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

        expect(inertia.calls[0]).toMatchObject({
            url: '/account/auth/code',
            data: { email: 'ana@example.test' },
        });
        expect(screen.getByRole('alert')).toHaveTextContent(
            'We could not send the code',
        );
        expect(screen.getByRole('status')).not.toHaveTextContent(
            'A new code was sent',
        );
    });

    it('returns to the email step with the address ready to change', () => {
        render(
            <Login
                step="code"
                email="ana@example.test"
                resendInSeconds={0}
                codeLength={6}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Return to the email step' }),
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Sign in with email',
            }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/Email address/)).toHaveValue(
            'ana@example.test',
        );
        expect(inertia.calls).toHaveLength(0);
    });

    it('restarts the cooldown and confirms a resend even when the cooldown value is unchanged, then clears it on verify', () => {
        vi.useFakeTimers();
        try {
            render(
                <Login
                    step="code"
                    email="ana@example.test"
                    resendInSeconds={2}
                    codeLength={6}
                />,
            );
            act(() => {
                vi.advanceTimersByTime(2000);
            });
            expect(screen.getByRole('status')).toHaveTextContent(
                'You can request another code now.',
            );

            fireEvent.click(
                screen.getByRole('button', { name: 'Resend code' }),
            );

            expect(
                screen.getByRole('button', { name: 'Resend code' }),
            ).toBeDisabled();
            expect(
                screen.getByText(/A new code was sent\. You can/),
            ).toHaveTextContent('in 2 seconds');
            expect(screen.getByRole('status')).toHaveTextContent(
                'A new code was sent.',
            );

            fireEvent.change(
                screen.getByRole('textbox', { name: 'Digit 1 of 6' }),
                { target: { value: '123456' } },
            );
            fireEvent.click(
                screen.getByRole('button', { name: 'Verify code' }),
            );

            expect(screen.queryByText(/A new code was sent/)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
