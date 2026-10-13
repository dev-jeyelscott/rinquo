import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import PlatformShell from '@/layouts/platform-shell';
import Admins from '@/pages/platform/admins';
import FailedJobs from '@/pages/platform/failed-jobs';
import Organizations from '@/pages/platform/organizations/index';
import Overview from '@/pages/platform/overview';
import { resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const admin = { name: 'Admin', email: 'admin@example.test' };
const shared = {
    appName: 'Rinquo',
    displayTimezone: 'Asia/Manila',
    flash: { status: null },
    platform: { admin, support: null },
};
const noPages = { previousUrl: null, nextUrl: null };

describe('Spec 08 shell', () => {
    it('renders the neutral mark, six destinations and a skip link to the main region', () => {
        resetInertia(shared, '/platform');
        render(<PlatformShell>page</PlatformShell>);

        expect(
            screen.getByRole('link', { name: 'Skip to main content' }),
        ).toHaveAttribute('href', '#platform-main');
        expect(screen.getByRole('main')).toHaveAttribute('id', 'platform-main');
        expect(screen.getByText('Platform')).toBeInTheDocument();
        expect(
            within(
                screen.getByRole('navigation', { name: 'Platform' }),
            ).getAllByRole('link'),
        ).toHaveLength(6);
    });

    it('announces a terminal support expiry politely and keeps the exit', () => {
        resetInertia(
            {
                ...shared,
                platform: {
                    admin,
                    support: {
                        id: 's1',
                        organizationName: 'Shine',
                        targetEmail: 'staff@example.test',
                        targetRole: 'staff',
                        reference: 'SUP-1',
                        expiresAt: new Date(Date.now() - 1000).toISOString(),
                        exitUrl: '/platform/support/s1/exit',
                    },
                },
            },
            '/platform/support/s1',
        );
        render(<PlatformShell>page</PlatformShell>);

        expect(screen.getByRole('timer')).toHaveTextContent('Session ended');
        expect(screen.getByText(/support session has ended/i)).toHaveAttribute(
            'role',
            'status',
        );
        expect(
            screen.queryByRole('navigation', { name: 'Platform' }),
        ).not.toBeInTheDocument();
    });
});

describe('Spec 08 overview', () => {
    beforeEach(() => resetInertia(shared, '/platform'));

    it('presents retained failures as a count, never as queue health', () => {
        render(
            <Overview
                failedJobs={3}
                activeAdmins={4}
                plan={{ amountCentavos: 99900, trialDays: 14, graceDays: 3 }}
                liveSupportSession={null}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Platform overview',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/not a live queue-health measurement/i),
        ).toBeInTheDocument();
        expect(screen.getByText('No support session is active.')).toBeVisible();
    });
});

describe('Spec 08 directories', () => {
    beforeEach(() => resetInertia(shared, '/platform/organizations'));

    it('lists organizations as one table with a single labelled Open action', () => {
        render(
            <Organizations
                search=""
                pagination={noPages}
                organizations={[
                    {
                        id: 1,
                        name: 'Sparkle Auto Spa',
                        slug: 'sparkle',
                        published: true,
                        entitlement: 'grace',
                        closed: false,
                        url: '/platform/organizations/1',
                    },
                ]}
            />,
        );
        const table = screen.getByRole('table', { name: 'Organizations' });

        expect(within(table).getByText('Grace period')).toBeInTheDocument();
        expect(
            within(table).getByRole('link', { name: 'Open Sparkle Auto Spa' }),
        ).toHaveAttribute('href', '/platform/organizations/1');
    });

    it('explains disabled administrators and offers only re-enable for them', () => {
        render(
            <Admins
                invitations={[]}
                admins={[
                    {
                        id: 2,
                        name: 'Off',
                        email: 'off@example.test',
                        status: 'disabled',
                        factorEnrolled: false,
                        lastLoginAt: null,
                    },
                ]}
            />,
        );

        expect(screen.getByText('Disabled')).toBeInTheDocument();
        expect(screen.getByText('No factor')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Re-enable off@example.test' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Disable off@/ }),
        ).not.toBeInTheDocument();
    });
});

describe('Spec 08 failed-job retry history', () => {
    beforeEach(() => resetInertia(shared, '/platform/failed-jobs'));

    it('states that queued means dispatch only and that a failed dispatch retains the job', () => {
        render(
            <FailedJobs
                jobs={[]}
                total={0}
                pagination={noPages}
                recentRetries={[
                    {
                        jobUuid: 'a',
                        jobClass: 'ProcessWebhookEvent',
                        status: 'queued',
                        at: '2026-10-13T01:02:00Z',
                    },
                    {
                        jobUuid: 'b',
                        jobClass: 'ProcessWebhookEvent',
                        status: 'dispatch_failed',
                        at: '2026-10-13T00:38:00Z',
                    },
                    {
                        jobUuid: 'c',
                        jobClass: 'ProcessWebhookEvent',
                        status: 'claimed',
                        at: '2026-10-12T09:10:00Z',
                    },
                ]}
            />,
        );
        const table = screen.getByRole('table', { name: 'Recent retries' });

        expect(within(table).getByText('Queued')).toBeInTheDocument();
        expect(
            within(table).getByText(/confirms dispatch only, not completion/i),
        ).toBeInTheDocument();
        expect(within(table).getByText('Dispatch failed')).toBeInTheDocument();
        expect(within(table).getByText(/job is retained/i)).toBeInTheDocument();
        expect(within(table).getByText('Claimed')).toBeInTheDocument();
        expect(
            screen.getByText(/do not establish overall queue health/i),
        ).toBeInTheDocument();
    });

    it('keeps the retry dialog labelled as a step-up', () => {
        render(
            <FailedJobs
                total={1}
                pagination={noPages}
                recentRetries={[]}
                jobs={[
                    {
                        uuid: 'u1',
                        queue: 'default',
                        jobClass: 'ProcessWebhookEvent',
                        exceptionClass: 'TimeoutException',
                        failedAt: '2026-10-13T00:13:00Z',
                        retryable: true,
                        retryNote: 'Safe to run again.',
                    },
                ]}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Retry ProcessWebhookEvent' }),
        );

        expect(screen.getByText('Step-up required')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Retry job' }),
        ).toBeDisabled();
    });
});
