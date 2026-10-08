import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Directory from '@/pages/owner/settings/directory';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const BASE = '/owner/organizations/1/settings';

function owner(
    over: Partial<OwnerPageProps['organization']> = {},
): OwnerPageProps {
    return {
        organization: {
            id: 1,
            name: 'Shine',
            slug: 'shine',
            publishedAt: '2026-10-01T00:00:00Z',
            shopUrl: 'x',
            operationsUrl: '/owner/organizations/1/operations',
            conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
            unresolvedConflicts: 0,
            bookingRequestsUrl: '/owner/organizations/1/booking-requests',
            baseUrl: BASE,
            billingUrl: BILLING_URL,
            ...over,
        },
        readiness: { isReady: true, items: [] },
        entitlement: ACTIVE_ENTITLEMENT,
    };
}

function renderPage(
    optedIn: boolean,
    over: Partial<OwnerPageProps['organization']> = {},
) {
    const props = owner(over);
    resetInertia(
        { organization: props.organization, readiness: props.readiness },
        `${BASE}/directory`,
    );

    return render(<Directory {...props} directoryOptedIn={optedIn} />);
}

describe('Directory settings', () => {
    beforeEach(() => resetInertia());

    it('renders one page heading and no nested Owner shell', () => {
        renderPage(true);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Settings · Directory',
            }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.queryByRole('navigation', { name: 'Main' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Primary mobile' }),
        ).not.toBeInTheDocument();
    });

    it('distinguishes preference, publication, readiness and effective listing', () => {
        renderPage(true);
        const summary = screen
            .getByText('Directory preference')
            .closest('dl') as HTMLElement;

        expect(within(summary).getByText('Enabled')).toBeInTheDocument();
        expect(within(summary).getByText('Published')).toBeInTheDocument();
        expect(within(summary).getByText('Ready')).toBeInTheDocument();
        expect(within(summary).getByText('Visible')).toBeInTheDocument();
    });

    it('does not claim a listing when opted in but unpublished', () => {
        renderPage(true, { publishedAt: null });

        expect(screen.getByText('Not listed')).toBeInTheDocument();
        expect(
            screen.getByText(/the shop is not published/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Opting in does not guarantee listing/),
        ).toBeInTheDocument();
    });

    it('saves the preference with the existing payload and shows a pending state', () => {
        renderPage(false);

        fireEvent.click(screen.getByLabelText(/Show in the Rinquo directory/));
        fireEvent.click(
            screen.getByRole('button', { name: 'Save directory preference' }),
        );

        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'put',
            url: `${BASE}/directory`,
            data: { directory_opted_in: true },
        });

        inertia.hold = true;
        fireEvent.click(
            screen.getByRole('button', { name: 'Save directory preference' }),
        );
        expect(
            screen.getByRole('button', { name: 'Saving...' }),
        ).toBeDisabled();
    });
});
