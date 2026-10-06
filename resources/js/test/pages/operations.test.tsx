import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Operations from '@/pages/owner/operations';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { OperationsPageData, QueueRowData } from '@/types/operations';
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
        billingUrl: BILLING_URL,
    },
    readiness: { isReady: true, items: [] },
    entitlement: ACTIVE_ENTITLEMENT,
};

function row(overrides: Partial<QueueRowData> = {}): QueueRowData {
    return {
        id: 'b1',
        customerName: 'Ana Cruz',
        customerPhone: null,
        vehicleName: 'Sedan',
        vehiclePlate: 'ABC 123',
        serviceName: 'Full wash',
        addOns: [],
        notes: null,
        startAt: '2026-10-05T02:00:00+00:00',
        serviceEndAt: '2026-10-05T03:00:00+00:00',
        etaAt: null,
        delayMinutes: 0,
        state: 'scheduled',
        source: 'online',
        resource: { id: 1, name: 'Bay 1' },
        units: 1,
        compatibleResourceIds: [1, 2],
        revision: 3,
        actions: {
            checkIn: true,
            start: false,
            complete: false,
            noShow: false,
            assign: true,
            reorder: true,
        },
        ...overrides,
    };
}

function data(overrides: Partial<OperationsPageData> = {}): OperationsPageData {
    return {
        day: {
            date: '2026-10-05',
            isToday: true,
            timezone: 'Asia/Manila',
            previous: '2026-10-04',
            next: '2026-10-06',
            today: '2026-10-05',
        },
        now: '2026-10-05T01:00:00+00:00',
        stats: {
            appointments: 2,
            waiting: 1,
            checkedIn: 1,
            inService: 0,
            completed: 0,
            noShow: 0,
        },
        queue: [row()],
        capacity: [
            { id: 1, name: 'Bay 1', capacity: 2, used: 2, blocked: false },
            { id: 2, name: 'Bay 2', capacity: 2, used: 0, blocked: true },
        ],
        blocks: [],
        attention: [],
        resources: [
            { id: 1, name: 'Bay 1', typeId: 1, capacity: 2 },
            { id: 2, name: 'Bay 2', typeId: 1, capacity: 2 },
        ],
        catalog: [],
        urls: {
            operations: '/owner/organizations/1/operations',
            bookings: '/owner/organizations/1/operations/bookings',
            blocks: '/owner/organizations/1/operations/blocks',
            failures: '/owner/organizations/1/operations/failures',
            create: '/owner/organizations/1/operations/bookings',
        },
        ...overrides,
    };
}

const base = '/owner/organizations/1/operations/bookings/b1';

describe('Operations dashboard', () => {
    beforeEach(() => resetInertia());

    it('shows counters, queue rows with status text and resource load', () => {
        render(<Operations {...owner} {...data()} />);

        const counts = screen.getByRole('list', { name: 'Counts for the day' });
        expect(counts).toHaveTextContent('Appointments');
        expect(counts).toHaveTextContent('1 not arrived');
        const queue = screen.getByRole('list', { name: 'Queue' });
        expect(
            within(queue).getByRole('heading', { name: 'Ana Cruz' }),
        ).toBeInTheDocument();
        expect(queue).toHaveTextContent('Booked');
        expect(queue).toHaveTextContent('10:00 AM');
        expect(queue).toHaveTextContent('Bay 1');
        const capacity = screen.getByRole('list', { name: 'Capacity now' });
        expect(capacity).toHaveTextContent('2 / 2 full');
        expect(capacity).toHaveTextContent('Blocked');
    });

    it('checks in with the revision and an idempotency key', () => {
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: `${base}/check-in`,
            data: { revision: 3 },
        });
        expect(inertia.calls[0].data.idempotency_key).toMatch(/[0-9a-f-]{36}/);
    });

    it('never reuses an idempotency key once the booking has changed', () => {
        const { rerender } = render(<Operations {...owner} {...data()} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        );

        rerender(
            <Operations
                {...owner}
                {...data({
                    queue: [
                        row({
                            state: 'checked_in',
                            revision: 4,
                            actions: {
                                checkIn: false,
                                start: true,
                                complete: false,
                                noShow: false,
                                assign: true,
                                reorder: true,
                            },
                        }),
                    ],
                })}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Start Ana Cruz' }));

        const keys = inertia.calls.map((call) => call.data.idempotency_key);
        expect(keys[0]).toBe(keys[1]);
        expect(keys[2]).not.toBe(keys[0]);
    });

    it('offers only the next valid action for the state', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    queue: [
                        row({
                            state: 'checked_in',
                            actions: {
                                checkIn: false,
                                start: true,
                                complete: false,
                                noShow: false,
                                assign: true,
                                reorder: true,
                            },
                        }),
                    ],
                })}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Check in Ana Cruz' }),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start Ana Cruz' }));
        expect(inertia.calls[0].url).toBe(`${base}/start`);
    });

    it('shows the projected finish and lateness for work in service and completes it', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    queue: [
                        row({
                            state: 'in_service',
                            etaAt: '2026-10-05T03:30:00+00:00',
                            delayMinutes: 30,
                            actions: {
                                checkIn: false,
                                start: false,
                                complete: true,
                                noShow: false,
                                assign: false,
                                reorder: false,
                            },
                        }),
                    ],
                })}
            />,
        );

        const queue = screen.getByRole('list', { name: 'Queue' });
        expect(queue).toHaveTextContent('In service');
        expect(queue).toHaveTextContent('Expected finish 11:30 AM');
        expect(queue).toHaveTextContent('Running 30 min late');
        fireEvent.click(
            screen.getByRole('button', { name: 'Complete Ana Cruz' }),
        );
        expect(inertia.calls[0].url).toBe(`${base}/complete`);
    });

    it('requires a reason before a no-show can be confirmed', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    queue: [
                        row({
                            actions: {
                                checkIn: true,
                                start: false,
                                complete: false,
                                noShow: true,
                                assign: true,
                                reorder: false,
                            },
                        }),
                    ],
                })}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Mark Ana Cruz as a no-show' }),
        );
        const dialog = screen.getByRole('dialog');
        const confirm = within(dialog).getByRole('button', {
            name: 'Confirm no-show',
        });
        expect(confirm).toBeDisabled();

        fireEvent.change(within(dialog).getByLabelText(/Reason/), {
            target: { value: 'No call' },
        });
        fireEvent.click(confirm);

        expect(inertia.calls[0]).toMatchObject({
            url: `${base}/no-show`,
            data: { confirm: 1, reason: 'No call', revision: 3 },
        });
    });

    it('moves a booking up the queue with a recorded reason', () => {
        const second = row({ id: 'b2', customerName: 'Ben Reyes' });
        render(<Operations {...owner} {...data({ queue: [row(), second] })} />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Move Ben Reyes ahead of Ana Cruz',
            }),
        );
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText(/Reason/), {
            target: { value: 'In a hurry' },
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Move up' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/organizations/1/operations/bookings/b2/reorder',
            data: { before: 'b1', reason: 'In a hurry' },
        });
    });

    it('assigns only a compatible resource from a contextual sheet', () => {
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Assign resource for Ana Cruz',
            }),
        );
        const sheet = screen.getByRole('dialog');
        const select = within(sheet).getByLabelText('Resource');
        expect(
            within(sheet).getByRole('option', { name: 'Bay 1 (current)' }),
        ).toBeInTheDocument();
        fireEvent.change(select, { target: { value: '2' } });
        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Assign resource' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: `${base}/assign`,
            data: { resource_id: 2, revision: 3 },
        });
    });

    it('says plainly when the day has no work', () => {
        render(<Operations {...owner} {...data({ queue: [] })} />);

        expect(
            screen.getByRole('heading', { name: 'Nothing booked today' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('list', { name: 'Queue' }),
        ).not.toBeInTheDocument();
    });

    it('shows a structure-matching skeleton while another day loads', () => {
        inertia.nextGet = 'pending';
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            data: { date: '2026-10-06' },
        });
        expect(screen.getByRole('status')).toHaveTextContent(
            'Loading the queue',
        );
        expect(
            screen.queryByRole('list', { name: 'Queue' }),
        ).not.toBeInTheDocument();
    });

    it('reports a failed refresh with a way to retry', () => {
        inertia.nextGet = 'network';
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'could not be refreshed',
        );
        expect(
            screen.getByRole('button', { name: 'Try again' }),
        ).toBeInTheDocument();
    });

    it('shows a stale revision error with a refresh action, never as success', () => {
        inertia.props = {
            errors: {
                revision: 'This booking changed. Refresh and try again.',
            },
        };
        render(<Operations {...owner} {...data()} />);

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('This booking changed');
        expect(
            within(alert).getByRole('button', { name: 'Refresh the queue' }),
        ).toBeInTheDocument();
    });

    it('lists failed notifications for attention and retries one after confirmation', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    attention: [
                        {
                            id: 'f1',
                            label: 'Booking confirmation',
                            customerName: 'Ana Cruz',
                            status: 'failed',
                            retryCount: 0,
                            failedAt: '2026-10-05T01:00:00+00:00',
                        },
                        {
                            id: 'f2',
                            label: 'Booking reminder',
                            customerName: 'Ben Reyes',
                            status: 'retrying',
                            retryCount: 1,
                            failedAt: '2026-10-05T01:00:00+00:00',
                        },
                    ],
                })}
            />,
        );

        const attention = screen.getByRole('list', {
            name: 'Failed notifications',
        });
        expect(attention).toHaveTextContent('Email delivery failed');
        expect(attention).toHaveTextContent('Failed');
        expect(attention).toHaveTextContent('Retrying');
        expect(
            screen.queryByRole('button', {
                name: 'Retry the Booking reminder email for Ben Reyes',
            }),
        ).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Retry the Booking confirmation email for Ana Cruz',
            }),
        );
        expect(inertia.calls).toHaveLength(0);
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Retry email',
            }),
        );
        expect(inertia.calls[0].url).toBe(
            '/owner/organizations/1/operations/failures/f1/retry',
        );
    });

    it('opens the walk-in form in a sheet and posts a walk-in to the server', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    catalog: [
                        {
                            id: 7,
                            name: 'Sedan',
                            services: [
                                {
                                    id: 9,
                                    name: 'Full wash',
                                    description: null,
                                    priceCentavos: 35000,
                                    durationMinutes: 60,
                                    bufferMinutes: 10,
                                    addOns: [],
                                },
                            ],
                        },
                    ],
                })}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        const sheet = screen.getByRole('dialog');
        fireEvent.change(within(sheet).getByLabelText(/Vehicle/), {
            target: { value: '7' },
        });
        fireEvent.change(within(sheet).getByLabelText(/Service/), {
            target: { value: '9' },
        });
        fireEvent.change(within(sheet).getByLabelText(/Customer name/), {
            target: { value: 'Walk-in Customer' },
        });
        fireEvent.submit(
            within(sheet).getByRole('form', { name: 'Add walk-in or booking' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/owner/organizations/1/operations/bookings',
            data: {
                mode: 'walk_in',
                vehicle_type_id: 7,
                service_id: 9,
                contact_name: 'Walk-in Customer',
                start_at: null,
            },
        });
    });

    it('shows the server reason when no gap is free', () => {
        inertia.nextErrors = {
            mode: 'There is no free gap left today for this service. Book a later time instead.',
        };
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        fireEvent.submit(
            within(screen.getByRole('dialog')).getByRole('form', {
                name: 'Add walk-in or booking',
            }),
        );

        expect(
            within(screen.getByRole('dialog')).getByRole('alert'),
        ).toHaveTextContent('no free gap left today');
    });

    it('lists active blocks and releases one', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    blocks: [
                        {
                            id: 'k1',
                            resourceId: 2,
                            resourceName: 'Bay 2',
                            startsAt: '2026-10-05T04:00:00+00:00',
                            endsAt: '2026-10-05T07:00:00+00:00',
                            reason: 'Pump repair',
                        },
                    ],
                })}
            />,
        );

        const list = screen.getByRole('list', { name: 'Blocked resources' });
        expect(list).toHaveTextContent('Pump repair');
        fireEvent.click(
            screen.getByRole('button', { name: 'Release the block on Bay 2' }),
        );
        expect(inertia.calls[0].url).toBe(
            '/owner/organizations/1/operations/blocks/k1/release',
        );
    });

    it('pauses new walk-ins with the reason while a restricted shop keeps working existing bookings', () => {
        render(
            <Operations
                {...owner}
                entitlement={{
                    ...ACTIVE_ENTITLEMENT,
                    state: 'restricted',
                    acceptsNewBookings: false,
                }}
                {...data({ queue: [row()] })}
            />,
        );

        const add = screen.getByRole('button', { name: 'Add walk-in' });
        expect(add).toBeDisabled();
        expect(add).toHaveAccessibleDescription(
            /New walk-ins and bookings are paused/,
        );
        expect(
            screen.getByRole('button', { name: /^Check in / }),
        ).toBeEnabled();
    });
});
