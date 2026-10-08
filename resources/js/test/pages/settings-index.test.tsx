import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import SettingsIndex from '@/pages/owner/settings/index';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { resetInertia } from '@/test/inertia';
import type { OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const BASE = '/owner/organizations/1/settings';

function ownerProps(isReady: boolean, failingTab?: string): OwnerPageProps {
    return {
        organization: {
            id: 1,
            name: 'Shine',
            slug: 'shine',
            publishedAt: null,
            shopUrl: 'x',
            operationsUrl: '/owner/organizations/1/operations',
            conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
            unresolvedConflicts: 0,
            bookingRequestsUrl: '/owner/organizations/1/booking-requests',
            baseUrl: BASE,
            billingUrl: BILLING_URL,
        },
        readiness: {
            isReady,
            items: failingTab
                ? [
                      {
                          key: 'x',
                          label: 'Business hours',
                          passed: false,
                          detail: '',
                          tab: failingTab as 'hours',
                      },
                  ]
                : [],
        },
        entitlement: ACTIVE_ENTITLEMENT,
    };
}

function renderIndex(props: OwnerPageProps) {
    resetInertia(
        { organization: props.organization, readiness: props.readiness },
        BASE,
    );

    return render(<SettingsIndex {...props} />);
}

const cards = () => screen.getByRole('region', { name: 'Owner Settings' });

describe('Settings index', () => {
    beforeEach(() => resetInertia());

    it('owns one Settings heading and lists exactly the seven destinations', () => {
        renderIndex(ownerProps(true));

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', { level: 1, name: 'Settings' }),
        ).toBeInTheDocument();

        const list = screen.getByRole('region', { name: 'Owner Settings' });
        const links = within(list).getAllByRole('link');
        expect(links).toHaveLength(7);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            `${BASE}/profile`,
            `${BASE}/hours`,
            `${BASE}/services`,
            `${BASE}/resources`,
            `${BASE}/booking-policy`,
            `${BASE}/readiness`,
            `${BASE}/directory`,
        ]);
        expect(
            within(list).queryByRole('link', { name: /billing/i }),
        ).not.toBeInTheDocument();
    });

    it('gives every destination a label and a short description', () => {
        renderIndex(ownerProps(true));

        const hours = within(cards()).getByRole('link', { name: /^Hours/ });
        expect(hours).toHaveTextContent('Weekly hours and overrides');
        expect(
            within(cards()).getByRole('link', { name: /^Booking Policy/ }),
        ).toHaveTextContent('Confirmation and scheduling rules');
    });

    it('states readiness in text, derived from the server checklist', () => {
        const { unmount } = renderIndex(ownerProps(true));
        expect(
            within(cards()).getByRole('link', { name: /^Readiness/ }),
        ).toHaveTextContent('Ready');
        unmount();

        renderIndex(ownerProps(false, 'hours'));
        expect(
            within(cards()).getByRole('link', { name: /^Readiness/ }),
        ).toHaveTextContent('Not ready');
        expect(
            within(cards()).getByRole('link', { name: /^Hours/ }),
        ).toHaveTextContent('Needs attention');
        expect(
            within(cards()).getByRole('link', { name: /^Profile/ }),
        ).not.toHaveTextContent('Needs attention');
    });

    it('marks no Settings destination current on the index and has no back link', () => {
        renderIndex(ownerProps(true));
        const nav = screen.getByRole('navigation', { name: 'Settings' });

        expect(
            within(nav)
                .getAllByRole('link')
                .some((link) => link.hasAttribute('aria-current')),
        ).toBe(false);
        expect(
            screen.queryByRole('link', { name: 'Settings' }),
        ).not.toBeInTheDocument();
    });
});
