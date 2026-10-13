import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import OwnerShell from '@/layouts/owner-shell';
import {
    ACTIVE_ENTITLEMENT,
    BILLING_URL,
    OWNER_VIEWER,
} from '@/test/fixtures/entitlement';
import { resetInertia } from '@/test/inertia';
import type { Entitlement } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const base = {
    appName: 'Rinquo',
    auth: { user: { email: 'owner@example.test' } },
    flash: { status: null },
    displayTimezone: 'Asia/Manila',
    organization: {
        id: 1,
        name: 'Shine',
        slug: 'shine',
        branchName: 'Main',
        publishedAt: '2026-10-01T00:00:00Z',
        shopUrl: 'x',
        operationsUrl: '/owner/organizations/1/operations',
        conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
        unresolvedConflicts: 0,
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: '/owner/organizations/1/settings',
        billingUrl: BILLING_URL,
    },
    readiness: { isReady: true, items: [] },
    viewer: OWNER_VIEWER,
};

function shell(
    entitlement: Partial<Entitlement>,
    url = '/owner/organizations/1/operations',
    errors = {},
) {
    resetInertia(
        {
            ...base,
            errors,
            entitlement: { ...ACTIVE_ENTITLEMENT, ...entitlement },
        },
        url,
    );

    return render(<OwnerShell>page</OwnerShell>);
}

describe('Entitlement banner in the Owner shell', () => {
    beforeEach(() => resetInertia());

    it('is silent for trial and paid organizations', () => {
        shell({ state: 'paid' });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('warns in grace with the exact pause date and keeps everything usable', () => {
        shell({ state: 'grace', graceEndsAt: '2026-11-26T00:00:00Z' });

        expect(
            screen.getByText('Paid period ended: grace active'),
        ).toBeInTheDocument();
        expect(screen.getByText(/November 26, 2026/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Renew now' })).toHaveAttribute(
            'href',
            BILLING_URL,
        );
    });

    it('says restriction keeps existing bookings and is not an outage, with renewal as the one action', () => {
        shell({
            state: 'restricted',
            acceptsNewBookings: false,
            allowsConfigurationWrites: false,
        });

        expect(screen.getByText('New bookings paused')).toBeInTheDocument();
        expect(
            screen.getByText(
                /Continue checking in, servicing and completing existing bookings/,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Renew now' }),
        ).toBeInTheDocument();
    });

    it('says an unpaid trial ended and shows no grace date', () => {
        shell({
            state: 'restricted',
            paidUntil: null,
            graceEndsAt: null,
            trialEndsAt: '2026-10-19T00:00:00Z',
            acceptsNewBookings: false,
        });

        expect(
            screen.getByText(/Your free trial ended on October 19, 2026/),
        ).toBeInTheDocument();
        expect(screen.queryByText(/grace/i)).not.toBeInTheDocument();
    });

    it('leaves the banner to the billing page itself, which owns its state banner', () => {
        shell({ state: 'restricted' }, BILLING_URL);

        expect(
            screen.queryByText('New bookings paused'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Renew now' }),
        ).not.toBeInTheDocument();
    });

    it('names closure separately from billing', () => {
        shell({
            closed: true,
            closure: {
                state: 'recoverable',
                requestedAt: '2026-10-01T00:00:00Z',
                recoverableUntil: '2026-12-30T00:00:00Z',
                deletionEligibleAt: null,
            },
        });

        expect(
            screen.getByText('This organization is closed'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /recover the organization until December 30, 2026/,
            ),
        ).toBeInTheDocument();
    });

    it('shows a stale-tab access error from the server', () => {
        shell(
            { state: 'restricted' },
            '/owner/organizations/1/settings/hours',
            {
                access: 'Your subscription has ended, so configuration is read-only. Renew to make changes.',
            },
        );

        expect(
            screen.getByText(/configuration is read-only/),
        ).toBeInTheDocument();
    });

    it('lists Billing as a main destination', () => {
        shell({ state: 'paid' });

        expect(
            within(screen.getByRole('navigation', { name: 'Main' })).getByRole(
                'link',
                { name: 'Billing' },
            ),
        ).toHaveAttribute('href', BILLING_URL);
    });
});
