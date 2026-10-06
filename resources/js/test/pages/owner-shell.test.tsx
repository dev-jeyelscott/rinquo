import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import OwnerShell from '@/layouts/owner-shell';
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
    },
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

describe('Owner shell', () => {
    beforeEach(() =>
        resetInertia(props, '/owner/organizations/1/settings/hours'),
    );

    it('marks the current tab and flags tabs that need attention', () => {
        render(<OwnerShell>page</OwnerShell>);
        const nav = screen.getByRole('navigation', { name: 'Settings' });

        expect(
            within(nav).getByRole('link', { name: /business hours/i }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(nav).getByRole('link', { name: /profile/i }),
        ).not.toHaveAttribute('aria-current');
        expect(
            within(nav).getByLabelText('Needs attention'),
        ).toBeInTheDocument();
        expect(within(nav).getAllByRole('link')).toHaveLength(7);
        expect(
            within(nav).getByRole('link', { name: 'Booking policy' }),
        ).toHaveAttribute(
            'href',
            '/owner/organizations/1/settings/booking-policy',
        );
        expect(
            within(nav).getByRole('link', { name: 'Directory' }),
        ).toHaveAttribute('href', '/owner/organizations/1/settings/directory');
    });

    it('keeps the sidebar to real destinations and the tabs in the content area', () => {
        render(<OwnerShell>page</OwnerShell>);
        const sidebar = screen.getByRole('navigation', { name: 'Main' });

        expect(within(sidebar).getAllByRole('link')).toHaveLength(4);
        expect(
            within(sidebar).getByRole('link', { name: 'Settings' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(sidebar).getByRole('link', { name: 'Booking requests' }),
        ).not.toHaveAttribute('aria-current');
        expect(
            screen
                .getByRole('main')
                .contains(screen.getByRole('navigation', { name: 'Settings' })),
        ).toBe(true);
    });

    it('shows the operations dashboard without the Owner-only configuration tabs', () => {
        resetInertia(props, '/owner/organizations/1/operations');
        render(<OwnerShell>page</OwnerShell>);

        expect(
            screen.getByRole('link', { name: 'Operations' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            screen.getByRole('heading', { name: 'Today’s operations' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Owner only')).not.toBeInTheDocument();
    });

    it('shows the conflict count in the sidebar and the conflicts page without configuration tabs', () => {
        resetInertia(
            {
                ...props,
                organization: { ...props.organization, unresolvedConflicts: 3 },
            },
            '/owner/organizations/1/scheduling-conflicts',
        );
        render(<OwnerShell>page</OwnerShell>);

        const link = screen.getByRole('link', { name: /Conflicts/ });
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
        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).not.toBeInTheDocument();
    });

    it('shows Booking requests without the Owner-only configuration tabs', () => {
        resetInertia(props, '/owner/organizations/1/booking-requests');
        render(<OwnerShell>page</OwnerShell>);

        expect(
            screen.getByRole('link', { name: 'Booking requests' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Owner only')).not.toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Booking requests' }),
        ).toBeInTheDocument();
    });

    it('labels the area as owner-only and shows branch and draft versus published', () => {
        render(<OwnerShell>page</OwnerShell>);
        expect(screen.getByText('Owner only')).toBeInTheDocument();
        expect(screen.getByText('Main Branch')).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Scheduling configuration',
            }),
        ).toBeInTheDocument();
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
});
