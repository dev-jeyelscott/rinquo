import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Readiness from '@/pages/owner/settings/readiness';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const organization = {
    id: 1,
    name: 'Shine',
    slug: 'shine',
    publishedAt: null,
    shopUrl: 'http://localhost/shops/shine',
    operationsUrl: '/owner/organizations/1/operations',
    conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
    unresolvedConflicts: 0,
    bookingRequestsUrl: '/owner/organizations/1/booking-requests',
    baseUrl: '/owner/organizations/1/settings',
    billingUrl: BILLING_URL,
};

const failing: OwnerPageProps['readiness'] = {
    isReady: false,
    items: [
        {
            key: 'offering',
            label: 'Bookable service offering',
            passed: false,
            detail: 'Complete at least one combination.',
            tab: 'services',
        },
    ],
};
const passing: OwnerPageProps['readiness'] = {
    isReady: true,
    items: [
        {
            key: 'offering',
            label: 'Bookable service offering',
            passed: true,
            detail: '1 combination can be booked.',
            tab: 'services',
        },
    ],
};
const variants = [
    {
        variant_id: 1,
        service_name: 'Full wash',
        vehicle_type_name: 'Sedan',
        available: false,
        reasons: ['missing_consumption'],
    },
];

function renderPage(
    over: Partial<React.ComponentProps<typeof Readiness>> = {},
) {
    return render(
        <Readiness
            organization={organization}
            readiness={failing}
            entitlement={ACTIVE_ENTITLEMENT}
            variants={variants}
            branchTimezone="Asia/Manila"
            {...over}
        />,
    );
}

describe('Readiness page', () => {
    beforeEach(() =>
        resetInertia(
            { organization, readiness: failing },
            '/owner/organizations/1/settings/readiness',
        ),
    );

    it('disables Publish while any check fails and explains why', () => {
        renderPage();

        expect(
            screen.getByRole('button', { name: 'Publish shop' }),
        ).toBeDisabled();
        for (const status of screen.getAllByRole('status')) {
            expect(status).toHaveTextContent('Complete the checklist');
            expect(status).toHaveTextContent('1 check needs attention');
        }
    });

    it('leads with the publication status before the checklist (mobile status-first order)', () => {
        renderPage({ readiness: passing });

        const [lead, card] = screen.getAllByRole('status');
        const checklist = screen.getByRole('heading', {
            level: 2,
            name: 'Readiness checklist',
        });

        expect(lead).toHaveClass('xl:hidden');
        expect(card).toHaveClass('max-xl:hidden');
        expect(
            lead.compareDocumentPosition(checklist) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('keeps passed checklist detail available to assistive tech but hidden on small screens', () => {
        renderPage({ readiness: passing });

        const detail = screen
            .getByRole('list', { name: 'Readiness checklist' })
            .querySelector('p');

        expect(detail).toHaveClass('max-sm:sr-only');
    });

    it('owns exactly one "Settings · Readiness" heading and no nested shell', () => {
        renderPage();

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Settings · Readiness',
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Primary mobile' }),
        ).not.toBeInTheDocument();
    });

    it('says the shop is ready when every check passes', () => {
        renderPage({ readiness: passing });

        for (const status of screen.getAllByRole('status')) {
            expect(status).toHaveTextContent('Ready to publish');
        }
    });

    it('lists unavailable combinations with the reason (missing consumption)', () => {
        renderPage();

        expect(screen.getByText('Full wash for Sedan')).toBeInTheDocument();
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
        expect(
            screen.getByText(/No resource consumption is set/),
        ).toBeInTheDocument();
    });

    it('enables Publish when ready and posts to the publish endpoint', () => {
        renderPage({
            readiness: passing,
            variants: [{ ...variants[0], available: true, reasons: [] }],
        });

        const publish = screen.getByRole('button', { name: 'Publish shop' });
        expect(publish).toBeEnabled();
        fireEvent.click(publish);

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/owner/organizations/1/settings/publish',
        });
    });

    it('shows the server validation error when publishing is refused', () => {
        renderPage({ readiness: passing });
        inertia.nextErrors = {
            publish:
                'Complete every readiness check before publishing: Business hours.',
        };

        fireEvent.click(screen.getByRole('button', { name: 'Publish shop' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Complete every readiness check before publishing',
        );
    });

    it('uses the AA-contrast tint text tokens on the status panels', () => {
        const live = renderPage({
            readiness: passing,
            organization: {
                ...organization,
                publishedAt: '2026-10-05T01:30:00+00:00',
            },
        });
        for (const status of screen.getAllByRole('status')) {
            expect(status.className).toContain('text-success-text');
            expect(status.className).not.toMatch(/text-success(\s|$)/);
        }
        live.unmount();

        renderPage();
        for (const status of screen.getAllByRole('status')) {
            expect(status.className).toContain('text-warning-text');
        }
    });

    it('shows the publication instant in the branch timezone with the public link', () => {
        renderPage({
            readiness: passing,
            organization: {
                ...organization,
                publishedAt: '2026-10-05T01:30:00+00:00',
            },
        });

        // 01:30 UTC is 9:30 AM in Asia/Manila.
        for (const status of screen.getAllByRole('status')) {
            expect(status).toHaveTextContent(/Oct 5, 2026/);
            expect(status).toHaveTextContent(/9:30\s?am/i);
        }
        expect(
            screen.getByRole('link', { name: 'http://localhost/shops/shine' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Publish shop' }),
        ).not.toBeInTheDocument();
        // One dominant next step (view the page) with Unpublish kept secondary.
        expect(
            screen.getByRole('link', { name: 'View public page' }),
        ).toHaveAttribute('href', 'http://localhost/shops/shine');
        expect(
            screen.getByRole('button', { name: 'Unpublish your shop' }),
        ).toBeInTheDocument();
    });
});
