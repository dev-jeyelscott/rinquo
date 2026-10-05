import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import BookingRequests from '@/pages/owner/booking-requests';
import { inertia, resetInertia } from '@/test/inertia';
import type { BookingRequest } from '@/types/booking';
import type { OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const owner: OwnerPageProps = {
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
        baseUrl: '/owner/organizations/1/settings',
    },
    readiness: { isReady: true, items: [] },
};

const request: BookingRequest = {
    id: 'b1',
    customerName: 'Ana Cruz',
    customerEmail: 'ana@example.test',
    customerPhone: '+63 912',
    vehicleName: 'Sedan',
    vehiclePlate: 'ABC 123',
    serviceName: 'Full wash',
    addOns: ['Wax'],
    notes: 'Rinse the wheels',
    startAt: '2026-10-06T02:00:00+00:00',
    pendingExpiresAt: new Date(Date.now() + 90 * 60_000).toISOString(),
    timezone: 'Asia/Manila',
    revision: 1,
    cancelUrl: '/owner/organizations/1/booking-requests/b1/cancel',
};

const none = { previousUrl: null, nextUrl: null };

describe('Booking requests', () => {
    beforeEach(() => resetInertia());

    it('lists each request with customer, vehicle, service, add-ons, time and time left', () => {
        render(
            <BookingRequests
                {...owner}
                requests={[request]}
                pagination={none}
            />,
        );

        const list = screen.getByRole('list', { name: 'Pending requests' });
        expect(
            within(list).getByRole('heading', { name: 'Ana Cruz' }),
        ).toBeInTheDocument();
        expect(list).toHaveTextContent('Sedan (ABC 123)');
        expect(list).toHaveTextContent('Full wash');
        expect(list).toHaveTextContent('Wax');
        expect(list).toHaveTextContent(
            'Tue, Oct 6, 10:00 AM (Philippine time)',
        );
        expect(list).toHaveTextContent('ana@example.test · +63 912');
        expect(list).toHaveTextContent(/1 h 29 min left|1 h 30 min left/);
    });

    it('says plainly that no requests are waiting', () => {
        render(<BookingRequests {...owner} requests={[]} pagination={none} />);

        expect(
            screen.getByRole('heading', { name: 'No requests waiting' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('list', { name: 'Pending requests' }),
        ).not.toBeInTheDocument();
    });

    it('approves with one action and no extra confirmation', () => {
        render(
            <BookingRequests
                {...owner}
                requests={[request]}
                pagination={none}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: "Approve Ana Cruz's request" }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/owner/organizations/1/booking-requests/b1/approve',
        });
    });

    it('asks for confirmation, with an optional reason, before declining', () => {
        render(
            <BookingRequests
                {...owner}
                requests={[request]}
                pagination={none}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: "Decline Ana Cruz's request" }),
        );
        const dialog = screen.getByRole('dialog');
        expect(
            within(dialog).getByText("Decline Ana Cruz's request?"),
        ).toBeInTheDocument();
        expect(inertia.calls).toHaveLength(0);

        fireEvent.change(within(dialog).getByLabelText(/Reason/), {
            target: { value: 'Private event' },
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Decline request' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/organizations/1/booking-requests/b1/decline',
            data: { reason: 'Private event' },
        });
    });

    it('shows the server error when a request expired or was decided in the meantime', () => {
        inertia.props = {
            ...inertia.props,
            errors: { booking: 'This request already expired or was decided.' },
        };
        render(
            <BookingRequests
                {...owner}
                requests={[request]}
                pagination={none}
            />,
        );

        expect(
            screen.getByText('This request already expired or was decided.'),
        ).toBeInTheDocument();
    });

    it('links to further pages when the list is paginated', () => {
        render(
            <BookingRequests
                {...owner}
                requests={[request]}
                pagination={{
                    previousUrl: null,
                    nextUrl: '/owner/organizations/1/booking-requests?page=2',
                }}
            />,
        );

        expect(
            screen.getByRole('link', { name: 'More requests' }),
        ).toHaveAttribute(
            'href',
            '/owner/organizations/1/booking-requests?page=2',
        );
    });
});
