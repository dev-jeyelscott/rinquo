import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import PlatformShell from '@/layouts/platform-shell';
import FailedJobs from '@/pages/platform/failed-jobs';
import SupportBookingRequests from '@/pages/platform/support/booking-requests';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const admin = { name: 'Admin', email: 'admin@example.test' };

describe('Platform shell', () => {
    beforeEach(() =>
        resetInertia(
            {
                appName: 'Rinquo',
                displayTimezone: 'Asia/Manila',
                flash: { status: null },
                platform: { admin, support: null },
            },
            '/platform/plan-terms',
        ),
    );

    it('marks the current destination and offers sign out', () => {
        render(<PlatformShell>page</PlatformShell>);
        const nav = screen.getByRole('navigation', { name: 'Platform' });

        expect(
            within(nav).getByRole('link', { name: 'Plan terms' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(nav).getByRole('link', { name: 'Overview' }),
        ).not.toHaveAttribute('aria-current');
        // Sign out is a POST (the Inertia test double renders the control as an anchor).
        expect(
            screen.getByText('Sign out').closest('[data-method]'),
        ).toHaveAttribute('data-method', 'post');
    });

    it('shows a persistent read-only banner with an exit during a support session', () => {
        resetInertia(
            {
                appName: 'Rinquo',
                displayTimezone: 'Asia/Manila',
                flash: { status: null },
                platform: {
                    admin,
                    support: {
                        id: 's1',
                        organizationName: 'Shine',
                        targetEmail: 'owner@example.test',
                        targetRole: 'owner',
                        reference: 'SUP-1',
                        expiresAt: new Date(Date.now() + 600000).toISOString(),
                        exitUrl: '/platform/support/s1/exit',
                    },
                },
            },
            '/platform/support/s1',
        );
        render(<PlatformShell>page</PlatformShell>);

        const banner = screen.getByRole('region', { name: 'Support session' });
        expect(banner).toHaveTextContent('Read-only support view');
        expect(banner).toHaveTextContent('Shine as owner owner@example.test');
        expect(
            within(banner)
                .getByText('Exit support session')
                .closest('[data-method]'),
        ).toHaveAttribute('data-method', 'post');
        // The main navigation is replaced while a support session is active.
        expect(
            screen.queryByRole('navigation', { name: 'Platform' }),
        ).not.toBeInTheDocument();
    });

    it('has no navigation or sign out when signed out', () => {
        resetInertia(
            {
                appName: 'Rinquo',
                displayTimezone: 'Asia/Manila',
                flash: { status: null },
                platform: { admin: null, support: null },
            },
            '/platform/login',
        );
        render(<PlatformShell>page</PlatformShell>);

        expect(
            screen.queryByRole('navigation', { name: 'Platform' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    });
});

describe('Step-up dialog', () => {
    beforeEach(() => resetInertia({ appName: 'Rinquo' }));

    function open() {
        render(
            <StepUpDialog
                label="Disable"
                title="Disable a@example.test"
                description="Signs them out."
                confirmLabel="Disable administrator"
                pendingLabel="Disabling..."
                url="/platform/admins/2/disable"
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    }

    it('requires the password and a six-digit code before it can confirm', () => {
        open();
        const confirm = screen.getByRole('button', {
            name: 'Disable administrator',
        });

        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'pw' },
        });
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '12345' },
        });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '123456' },
        });
        expect(confirm).toBeEnabled();

        fireEvent.click(confirm);
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/platform/admins/2/disable',
            data: { current_password: 'pw', otp_code: '123456' },
        });
    });

    it('shows a rejected step-up beside the field and keeps the dialog open', () => {
        open();
        inertia.nextErrors = {
            otp_code: 'Your password or authenticator code was not accepted.',
        };

        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'pw' },
        });
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '123456' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Disable administrator' }),
        );

        expect(
            screen.getByText(
                'Your password or authenticator code was not accepted.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('is not optimistic: it stays pending, disabled and labelled until the request settles', () => {
        open();
        inertia.hold = true;

        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'pw' },
        });
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '123456' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Disable administrator' }),
        );

        const busy = screen.getByRole('button', { name: 'Disabling...' });
        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
        expect(inertia.calls).toHaveLength(1);
    });

    it('tells the admin nothing changed when the network fails', () => {
        open();
        inertia.networkFailure = true;

        fireEvent.change(screen.getByLabelText(/^password/i), {
            target: { value: 'pw' },
        });
        fireEvent.change(screen.getByLabelText(/authenticator code/i), {
            target: { value: '123456' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Disable administrator' }),
        );

        expect(
            screen.getByText(/offline\. Nothing was changed/i),
        ).toBeInTheDocument();
    });
});

describe('Failed jobs page', () => {
    beforeEach(() =>
        resetInertia({ appName: 'Rinquo', displayTimezone: 'Asia/Manila' }),
    );

    const base = {
        total: 2,
        pagination: { previousUrl: null, nextUrl: null },
        recentRetries: [],
    };

    it('offers retry only for a retryable job and never shows payload or messages', () => {
        render(
            <FailedJobs
                {...base}
                jobs={[
                    {
                        uuid: 'u1',
                        queue: 'default',
                        jobClass: 'App\\Jobs\\Safe',
                        exceptionClass: 'RuntimeException',
                        failedAt: '2026-10-06T01:00:00Z',
                        retryable: true,
                        retryNote: 'Safe to run again.',
                    },
                    {
                        uuid: 'u2',
                        queue: 'default',
                        jobClass: 'App\\Jobs\\Unsafe',
                        exceptionClass: 'LogicException',
                        failedAt: '2026-10-06T01:00:00Z',
                        retryable: false,
                        retryNote: 'Not proven safe.',
                    },
                ]}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Retry App\\Jobs\\Safe' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Retry App\\Jobs\\Unsafe/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Not retryable here')).toBeInTheDocument();
    });

    it('lets a long retried class name wrap instead of overflowing', () => {
        const jobClass =
            'App\\Modules\\Subscription\\Jobs\\ProcessWebhookEvent';
        render(
            <FailedJobs
                {...base}
                total={0}
                jobs={[]}
                recentRetries={[
                    {
                        jobUuid: 'u1',
                        jobClass,
                        status: 'queued',
                        at: '2026-10-06T01:00:00Z',
                    },
                ]}
            />,
        );

        expect(screen.getByText(jobClass).closest('li')).toHaveClass(
            'break-words',
        );
        expect(screen.getByText(jobClass)).toHaveClass(
            '[overflow-wrap:anywhere]',
        );
    });

    it('explains an empty list', () => {
        render(<FailedJobs {...base} total={0} jobs={[]} />);

        expect(
            screen.getByText('No failed jobs are retained.'),
        ).toBeInTheDocument();
    });
});

describe('Support booking requests', () => {
    beforeEach(() =>
        resetInertia({ appName: 'Rinquo', displayTimezone: 'Asia/Manila' }),
    );

    it('is read-only: no approve or decline controls, and an empty state', () => {
        render(
            <SupportBookingRequests
                requests={[]}
                pagination={{ previousUrl: null, nextUrl: null }}
                overviewUrl="/platform/support/s1"
            />,
        );

        expect(
            screen.getByText(/no requests are waiting/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /approve|decline|cancel/i }),
        ).not.toBeInTheDocument();
    });
});
