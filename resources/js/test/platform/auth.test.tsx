import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import AcceptInvitation from '@/pages/platform/auth/accept-invitation';
import Enroll from '@/pages/platform/auth/enroll';
import Factor from '@/pages/platform/auth/factor';
import Login from '@/pages/platform/auth/login';
import RecoveryCodes from '@/pages/platform/auth/recovery-codes';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('Platform sign in', () => {
    beforeEach(() => resetInertia());

    it('has one h1, labelled fields and posts to the platform route', () => {
        render(<Login signedOutReason={null} />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Platform sign in' }),
        ).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/email address/i), {
            target: { value: 'admin@example.test' },
        });
        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'a-long-passphrase' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/platform/login',
            data: {
                email: 'admin@example.test',
                password: 'a-long-passphrase',
            },
        });
    });

    it('shows a generic credential error associated with the field and clears the password', () => {
        render(<Login signedOutReason={null} />);
        inertia.nextErrors = { email: 'These credentials were not accepted.' };

        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'wrong' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const email = screen.getByLabelText(/email address/i);
        expect(email).toHaveAttribute('aria-invalid', 'true');
        expect(email).toHaveAccessibleDescription(
            'These credentials were not accepted.',
        );
        expect(screen.getByLabelText(/^password/i)).toHaveValue('');
    });

    it('disables the control and names the pending action while signing in', () => {
        render(<Login signedOutReason={null} />);
        inertia.hold = true;

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const busy = screen.getByRole('button', { name: 'Checking...' });
        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
    });

    it('explains why a session ended', () => {
        render(<Login signedOutReason="idle" />);

        expect(screen.getByRole('status')).toHaveTextContent(
            '30 minutes of inactivity',
        );
    });
});

describe('Second factor', () => {
    beforeEach(() => resetInertia());

    it('enables verification only for a full six-digit code and strips non-digits', () => {
        render(<Factor email="admin@example.test" />);
        const verify = screen.getByRole('button', {
            name: 'Verify and sign in',
        });
        const input = screen.getByLabelText(/authenticator code/i);

        expect(verify).toBeDisabled();
        fireEvent.change(input, { target: { value: '12ab34' } });
        expect(input).toHaveValue('1234');
        fireEvent.change(input, { target: { value: '123456' } });
        fireEvent.click(verify);

        expect(inertia.calls[0]).toMatchObject({
            url: '/platform/mfa',
            data: { code: '123456' },
        });
        expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    });

    it('offers a recovery code instead and submits only that field', () => {
        render(<Factor email="admin@example.test" />);

        fireEvent.click(
            screen.getByRole('button', { name: /use a recovery code/i }),
        );
        fireEvent.change(screen.getByLabelText(/recovery code/i), {
            target: { value: 'abcde-fghjk' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and sign in' }),
        );

        expect(inertia.calls[0].data).toEqual({ recovery_code: 'abcde-fghjk' });
    });

    it('shows a rejected code and clears the entry', () => {
        render(<Factor email="admin@example.test" />);
        inertia.nextErrors = { code: 'That code was not accepted.' };

        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '000000' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify and sign in' }),
        );

        expect(
            screen.getByText('That code was not accepted.'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/authenticator code/i)).toHaveValue('');
    });
});

describe('Authenticator enrollment', () => {
    beforeEach(() => resetInertia());

    it('shows the setup key and confirms with a code', () => {
        render(
            <Enroll
                secret="JBSWY3DPEHPK3PXP"
                otpauthUri="otpauth://totp/Rinquo:admin?secret=JBSWY3DPEHPK3PXP"
                email="admin@example.test"
            />,
        );

        expect(screen.getByTestId('setup-key')).toHaveTextContent(
            'JBSWY3DPEHPK3PXP',
        );
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '654321' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm and continue' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/platform/enroll',
            data: { code: '654321' },
        });
    });
});

describe('Recovery codes', () => {
    it('lists every code once with a save warning and a continue link', () => {
        resetInertia();
        render(<RecoveryCodes codes={['aaaaa-bbbbb', 'ccccc-ddddd']} />);

        expect(
            screen.getByRole('list', { name: 'Recovery codes' }).children,
        ).toHaveLength(2);
        expect(screen.getByText(/shown only now/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /continue/i })).toHaveAttribute(
            'href',
            '/platform',
        );
    });
});

describe('Invitation', () => {
    beforeEach(() => resetInertia());

    it('explains an unusable invitation without a form', () => {
        render(<AcceptInvitation token="t" usable={false} />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Invitation unavailable',
            }),
        ).toBeInTheDocument();
        expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    });

    it('posts the name and password to the invitation route', () => {
        render(<AcceptInvitation token="abc" usable />);

        fireEvent.change(screen.getByLabelText(/your name/i), {
            target: { value: 'New Admin' },
        });
        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'a-long-passphrase' },
        });
        fireEvent.change(screen.getByLabelText(/confirm password/i), {
            target: { value: 'a-long-passphrase' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

        expect(inertia.calls[0]).toMatchObject({
            url: '/platform/invitations/abc',
            data: { name: 'New Admin' },
        });
    });
});
