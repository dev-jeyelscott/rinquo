import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import OwnerShell from '@/layouts/owner-shell';
import {
    ACTIVE_ENTITLEMENT,
    BILLING_URL,
    OWNER_VIEWER,
    STAFF_VIEWER,
} from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const props = {
    appName: 'Rinquo',
    auth: { user: { email: 'owner@example.test' } },
    flash: { status: null as string | null },
    organization: {
        id: 1,
        name: 'Shine',
        slug: 'shine',
        branchName: 'Main Branch',
        publishedAt: null,
        shopUrl: 'x',
        operationsUrl: '/owner/organizations/1/operations',
        conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
        unresolvedConflicts: 0,
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: '/owner/organizations/1/settings',
        billingUrl: BILLING_URL,
    },
    entitlement: ACTIVE_ENTITLEMENT,
    viewer: OWNER_VIEWER,
    readiness: {
        isReady: false,
        items: [
            {
                key: 'hours',
                label: 'Business hours',
                passed: false,
                detail: '',
                tab: 'hours',
            },
        ],
    },
};

const SETTINGS = '/owner/organizations/1/settings';

describe('Owner shell', () => {
    beforeEach(() => resetInertia(props, `${SETTINGS}/hours`));

    it('offers a skip link that moves focus to the main content', () => {
        render(<OwnerShell>page</OwnerShell>);

        const skip = screen.getByRole('link', { name: 'Skip to main content' });
        fireEvent.click(skip);

        expect(screen.getByRole('main')).toHaveFocus();
    });

    it('shows the five desktop destinations in the approved order with Settings active', () => {
        render(<OwnerShell>page</OwnerShell>);
        const sidebar = screen.getByRole('navigation', { name: 'Main' });
        const links = within(sidebar).getAllByRole('link');

        expect(links.map((link) => link.textContent)).toEqual([
            'Operations',
            'Booking Requests',
            'Conflicts',
            'Billing',
            'Settings',
        ]);
        expect(
            within(sidebar).getByRole('link', { name: 'Settings' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(sidebar).getByRole('link', { name: 'Settings' }),
        ).toHaveAttribute('href', SETTINGS);
        expect(
            within(sidebar).getByRole('link', { name: 'Billing' }),
        ).not.toHaveAttribute('aria-current');
    });

    it('offers five URL-backed bottom tabs over the one Operations page, with More active inside Settings', () => {
        render(<OwnerShell>page</OwnerShell>);
        const bar = screen.getByRole('navigation', { name: 'Primary mobile' });
        const ops = '/owner/organizations/1/operations';
        const links = within(bar).getAllByRole('link');

        expect(links.map((link) => link.textContent)).toEqual([
            'Dashboard',
            'Queue',
            'Bookings',
            'Walk-in',
            'More',
        ]);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            ops,
            `${ops}?view=queue`,
            `${ops}?view=bookings`,
            `${ops}?view=walk-in`,
            `${ops}?view=more`,
        ]);
        expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(
            within(bar).getByRole('link', { name: 'Dashboard' }),
        ).not.toHaveAttribute('aria-current');
    });

    it.each([
        ['', 'Dashboard'],
        ['?view=queue', 'Queue'],
        ['?view=bookings', 'Bookings'],
        ['?view=walk-in', 'Walk-in'],
        ['?view=more', 'More'],
        ['?date=2026-10-04&view=queue&queue_page=2', 'Queue'],
    ])('marks exactly the %s focused view as current', (query, active) => {
        resetInertia(props, `/owner/organizations/1/operations${query}`);
        render(<OwnerShell>page</OwnerShell>);
        const bar = screen.getByRole('navigation', { name: 'Primary mobile' });

        for (const link of within(bar).getAllByRole('link')) {
            if (link.textContent === active) {
                expect(link).toHaveAttribute('aria-current', 'page');
            } else {
                expect(link).not.toHaveAttribute('aria-current');
            }
        }
    });

    it('shows Staff only operational destinations, never Billing or Settings', () => {
        resetInertia(
            { ...props, viewer: STAFF_VIEWER },
            '/owner/organizations/1/operations',
        );
        render(<OwnerShell>page</OwnerShell>);
        const sidebar = screen.getByRole('navigation', { name: 'Main' });

        expect(
            within(sidebar)
                .getAllByRole('link')
                .map((link) => link.textContent),
        ).toEqual(['Operations', 'Booking Requests', 'Conflicts']);
        expect(
            screen.queryByRole('link', { name: 'Billing' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Settings' }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Staff workspace')).toBeInTheDocument();
    });

    it('labels an Owner workspace', () => {
        resetInertia(props, '/owner/organizations/1/operations');
        render(<OwnerShell>page</OwnerShell>);

        expect(screen.getByText('Owner workspace')).toBeInTheDocument();
    });

    it('keeps More active on the Settings index and moves the active item with the route', () => {
        resetInertia(props, SETTINGS);
        const { unmount } = render(<OwnerShell>page</OwnerShell>);
        let bar = screen.getByRole('navigation', { name: 'Primary mobile' });

        expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        unmount();

        resetInertia(props, '/owner/organizations/1/operations');
        render(<OwnerShell>page</OwnerShell>);
        bar = screen.getByRole('navigation', { name: 'Primary mobile' });

        expect(
            within(bar).getByRole('link', { name: 'Dashboard' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(bar).getByRole('link', { name: 'More' }),
        ).not.toHaveAttribute('aria-current');
    });

    it('has no hamburger, filled Settings pills, Owner-only chip or generic Settings heading', () => {
        render(<OwnerShell>page</OwnerShell>);

        expect(screen.queryByText('Owner only')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /menu/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { level: 1 }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Scheduling configuration'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).not.toBeInTheDocument();
    });

    it('keeps the shell-owned heading and no Settings chrome on operational pages', () => {
        resetInertia(props, '/owner/organizations/1/operations');
        render(<OwnerShell>page</OwnerShell>);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Today’s operations',
            }),
        ).toBeInTheDocument();
        expect(
            within(screen.getByRole('navigation', { name: 'Main' })).getByRole(
                'link',
                { name: 'Operations' },
            ),
        ).toHaveAttribute('aria-current', 'page');
    });

    it('shows the conflict count on the sidebar link and the conflicts page heading', () => {
        resetInertia(
            {
                ...props,
                organization: { ...props.organization, unresolvedConflicts: 3 },
            },
            '/owner/organizations/1/scheduling-conflicts',
        );
        render(<OwnerShell>page</OwnerShell>);

        const link = within(
            screen.getByRole('navigation', { name: 'Main' }),
        ).getByRole('link', { name: /Conflicts/ });
        expect(link).toHaveAttribute('aria-current', 'page');
        expect(within(link).getByLabelText('3 unresolved')).toHaveTextContent(
            '3',
        );
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Scheduling conflicts',
            }),
        ).toBeInTheDocument();
    });

    it('shows Booking Requests as active with its heading', () => {
        resetInertia(props, '/owner/organizations/1/booking-requests');
        render(<OwnerShell>page</OwnerShell>);

        expect(
            within(screen.getByRole('navigation', { name: 'Main' })).getByRole(
                'link',
                { name: 'Booking Requests' },
            ),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            screen.getByRole('heading', { level: 1, name: 'Booking requests' }),
        ).toBeInTheDocument();
        // Booking Requests is a secondary destination reached through More on a phone.
        const bar = screen.getByRole('navigation', { name: 'Primary mobile' });
        expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(
            within(bar).getByRole('link', { name: 'Bookings' }),
        ).not.toHaveAttribute('aria-current');
    });

    it('treats Billing as a primary destination, outside Settings', () => {
        resetInertia(props, BILLING_URL);
        render(<OwnerShell>page</OwnerShell>);
        const sidebar = screen.getByRole('navigation', { name: 'Main' });

        expect(
            within(sidebar).getByRole('link', { name: 'Billing' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(sidebar).getByRole('link', { name: 'Settings' }),
        ).not.toHaveAttribute('aria-current');
        expect(
            screen.getByRole('heading', { level: 1, name: 'Billing' }),
        ).toBeInTheDocument();
    });

    it('shows the branch and publication context without making it navigation', () => {
        render(<OwnerShell>page</OwnerShell>);

        expect(screen.getAllByText('Main Branch').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
        const context = screen.getByRole('group', {
            name: 'Branch and publication',
        });
        expect(within(context).queryByRole('link')).not.toBeInTheDocument();
    });

    it('announces a success message in a status region', () => {
        inertia.props = { ...props, flash: { status: 'Profile saved.' } };
        render(<OwnerShell>page</OwnerShell>);

        expect(screen.getByRole('status')).toHaveTextContent('Profile saved.');
    });

    it('offers sign out as a POST', () => {
        render(<OwnerShell>page</OwnerShell>);

        expect(
            screen.getAllByRole('link', { name: 'Sign out' })[0],
        ).toHaveAttribute('data-method', 'post');
    });

    it('marks the bottom bar so focus scrolling can reserve its height (focus not obscured)', () => {
        render(<OwnerShell>page</OwnerShell>);

        expect(
            screen.getByRole('navigation', { name: 'Primary mobile' }),
        ).toHaveAttribute('data-bottom-nav');

        const css = readFileSync('resources/css/app.css', 'utf8');
        expect(css).toMatch(
            /html:has\(\[data-bottom-nav\]\)\s*\{[^}]*scroll-padding-bottom:[^;]*env\(safe-area-inset-bottom\)/,
        );
    });

    it('uses the full-strength ring token for shell link focus (3:1 on light surfaces)', () => {
        render(<OwnerShell>page</OwnerShell>);
        const bar = screen.getByRole('navigation', { name: 'Primary mobile' });

        for (const link of within(bar).getAllByRole('link')) {
            expect(link.className).toContain('focus-visible:ring-ring');
            expect(link.className).not.toContain('ring-ring/50');
        }
    });
});
