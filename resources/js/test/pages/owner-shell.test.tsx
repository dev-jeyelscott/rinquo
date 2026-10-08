import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import OwnerShell from '@/layouts/owner-shell';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
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

    it('offers native-style bottom navigation with More active inside Settings', () => {
        render(<OwnerShell>page</OwnerShell>);
        const bar = screen.getByRole('navigation', { name: 'Primary mobile' });
        const links = within(bar).getAllByRole('link');

        expect(links.map((link) => link.textContent)).toEqual([
            'Dashboard',
            'Queue',
            'Bookings',
            'Walk-in',
            'More',
        ]);
        expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute(
            'href',
            SETTINGS,
        );
        expect(
            within(bar).getByRole('link', { name: 'Queue' }),
        ).toHaveAttribute(
            'href',
            '/owner/organizations/1/operations#queue-heading',
        );
        expect(
            within(bar).getByRole('link', { name: 'Dashboard' }),
        ).not.toHaveAttribute('aria-current');
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
        expect(
            within(
                screen.getByRole('navigation', { name: 'Primary mobile' }),
            ).getByRole('link', { name: 'Bookings' }),
        ).toHaveAttribute('aria-current', 'page');
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

    it('reaches Conflicts and Billing on small screens through More destinations', () => {
        render(<OwnerShell>page</OwnerShell>);
        const more = screen.getByRole('navigation', {
            name: 'More destinations',
        });

        expect(
            within(more).getByRole('link', { name: 'Conflicts' }),
        ).toHaveAttribute(
            'href',
            '/owner/organizations/1/scheduling-conflicts',
        );
        expect(
            within(more).getByRole('link', { name: 'Billing' }),
        ).toHaveAttribute('href', BILLING_URL);
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
        const more = screen.getByRole('navigation', {
            name: 'More destinations',
        });

        for (const link of [
            ...within(bar).getAllByRole('link'),
            ...within(more).getAllByRole('link'),
        ]) {
            expect(link.className).toContain('focus-visible:ring-ring');
            expect(link.className).not.toContain('ring-ring/50');
        }
    });
});
