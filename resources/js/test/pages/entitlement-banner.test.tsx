import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import OwnerShell from '@/layouts/owner-shell';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
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
            screen.getByText('Your paid period has ended'),
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

        expect(
            screen.getByText('Your subscription has ended'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /Existing bookings, check-in, completion and customer cancellations still work/,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Renew now' }),
        ).toBeInTheDocument();
    });

    it('does not repeat the renewal link on the billing page itself', () => {
        shell({ state: 'restricted' }, BILLING_URL);

        expect(
            screen.getByText('Your subscription has ended'),
        ).toBeInTheDocument();
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

        expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
            'href',
            BILLING_URL,
        );
    });
});
