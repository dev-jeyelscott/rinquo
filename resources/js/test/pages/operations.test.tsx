import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { router } from '@inertiajs/react';
import Operations from '@/pages/owner/operations';
import {
    ACTIVE_ENTITLEMENT,
    OWNER_VIEWER,
    BILLING_URL,
} from '@/test/fixtures/entitlement';
import { fakeEcho } from '@/test/fixtures/echo';
import { inertia, resetInertia } from '@/test/inertia';
import type {
    OperationsPageData,
    PageInfo,
    QueueRowData,
} from '@/types/operations';
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
    viewer: OWNER_VIEWER,
};

function row(overrides: Partial<QueueRowData> = {}): QueueRowData {
    return {
        id: 'b1',
        customerName: 'Ana Cruz',
        customerPhone: null,
        vehicleName: 'Sedan',
        vehiclePlate: 'ABC 123',
        serviceName: 'Full wash',
        resourceTypeName: 'Wash bay',
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
        graceMinutes: 15,
        noShowEligibleAt: '2026-10-05T02:15:00+00:00',
        lateArrivalAt: null,
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

function page(total: number, over: Partial<PageInfo> = {}): PageInfo {
    return {
        page: 1,
        perPage: 50,
        total,
        lastPage: 1,
        from: total === 0 ? 0 : 1,
        to: total,
        ...over,
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
            delayed: 0,
        },
        view: 'dashboard',
        filter: 'all',
        pages: {
            queue: page(1),
            blocks: page(0),
            failures: page(0),
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

/** Opens the contextual details sheet of a booking and returns it. */
function openDetails(name: string) {
    fireEvent.click(
        screen.getByRole('button', { name: `Booking details for ${name}` }),
    );

    return screen.getByRole('dialog', { name: 'Booking details' });
}

describe('Operations dashboard', () => {
    beforeEach(() => {
        resetInertia();
        fakeEcho();
    });
    afterEach(() => {
        delete window.Echo;
    });

    it('shows counters, queue rows with status text and resource load', () => {
        render(<Operations {...owner} {...data()} />);

        const counts = screen.getByRole('list', { name: 'Counts for the day' });
        expect(counts).toHaveTextContent('Appointments');
        expect(counts).toHaveTextContent('1 not arrived');
        expect(counts).toHaveTextContent('Ready for staff action');
        const queue = screen.getByRole('list', { name: 'Queue' });
        expect(
            within(queue).getByRole('button', {
                name: 'Booking details for Ana Cruz',
            }),
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
        expect(queue).toHaveTextContent('finishes 11:30 AM');
        expect(queue).toHaveTextContent('Estimated finish: 11:30 AM');
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

        openDetails('Ana Cruz');
        fireEvent.click(
            screen.getByRole('button', { name: 'Mark Ana Cruz as a no-show' }),
        );
        const dialog = screen.getByRole('dialog', { name: /no-show/ });
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
        // Settled: neither the confirmation nor the sheet it came from is left covering the page.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('moves a booking up the queue with a recorded reason', () => {
        const second = row({ id: 'b2', customerName: 'Ben Reyes' });
        render(<Operations {...owner} {...data({ queue: [row(), second] })} />);

        openDetails('Ben Reyes');
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Move up: Ben Reyes ahead of Ana Cruz',
            }),
        );
        const dialog = screen.getByRole('dialog', { name: /Move Ben Reyes/ });
        fireEvent.change(within(dialog).getByLabelText(/Reason/), {
            target: { value: 'In a hurry' },
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Confirm move up' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/organizations/1/operations/bookings/b2/reorder',
            data: { before: 'b1', reason: 'In a hurry' },
        });
    });

    it('assigns only a compatible resource from a contextual sheet', () => {
        render(<Operations {...owner} {...data()} />);

        openDetails('Ana Cruz');
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Assign resource for Ana Cruz',
            }),
        );
        const sheet = screen.getByRole('dialog', { name: /Assign a resource/ });
        // One sheet at a time: the details sheet gave way to the assignment sheet.
        expect(
            screen.queryByRole('dialog', { name: 'Booking details' }),
        ).not.toBeInTheDocument();
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

    it('lists failed notifications for attention and retries one after confirmation', async () => {
        render(
            <Operations
                {...owner}
                {...data({
                    pages: {
                        queue: page(1),
                        blocks: page(0),
                        failures: page(2),
                    },
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
        // The dialog closes onto a stable target because the Retry control is replaced.
        await waitFor(() =>
            expect(
                screen.getByRole('heading', { name: 'Attention needed' }),
            ).toHaveFocus(),
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

        const alert = within(screen.getByRole('dialog')).getByRole('alert');
        expect(alert).toHaveTextContent('no free gap left today');
        // The rejection is announced and focused beside the pinned action.
        expect(alert).toHaveFocus();
    });

    it('focuses the first invalid field with its message after a rejected submit', () => {
        inertia.nextErrors = {
            contact_name: 'The customer name field is required.',
        };
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        const sheet = screen.getByRole('dialog');
        fireEvent.submit(
            within(sheet).getByRole('form', { name: 'Add walk-in or booking' }),
        );

        const field = within(sheet).getByLabelText(/Customer name/);
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription(
            'The customer name field is required.',
        );
        expect(field).toHaveFocus();
    });

    it('sends null, not 0, for unchosen selects so the server reports them', () => {
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        fireEvent.submit(
            within(screen.getByRole('dialog')).getByRole('form', {
                name: 'Add walk-in or booking',
            }),
        );

        expect(inertia.calls[0].data).toMatchObject({
            vehicle_type_id: null,
            service_id: null,
        });
    });

    it('sends a null resource from the block sheet when none is chosen', () => {
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Block a resource' }),
        );
        fireEvent.submit(
            within(screen.getByRole('dialog')).getByRole('form', {
                name: 'Block a resource',
            }),
        );

        expect(inertia.calls[0].data).toMatchObject({ resource_id: null });
    });

    it('focuses the form alert when the only invalid control is disabled', () => {
        inertia.nextErrors = {
            service_id: 'The service field is required.',
            mode: 'Choose a vehicle first.',
        };
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        const sheet = screen.getByRole('dialog');
        fireEvent.submit(
            within(sheet).getByRole('form', { name: 'Add walk-in or booking' }),
        );

        expect(within(sheet).getByRole('alert')).toHaveFocus();
    });

    it('keeps the primary action in a pinned footer of the walk-in sheet', () => {
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
        const footer = within(screen.getByRole('dialog'))
            .getByRole('button', { name: 'Add walk-in' })
            .closest('.sticky');

        expect(footer).not.toBeNull();
        expect(
            within(footer as HTMLElement).getByRole('button', {
                name: 'Cancel',
            }),
        ).toBeInTheDocument();
    });

    it('returns focus to the row after an action removes the pressed control', () => {
        let options: Record<string, (() => void) | undefined> = {};
        vi.spyOn(router, 'post').mockImplementationOnce(
            (_url: unknown, _data: unknown, opts?: unknown) => {
                options = opts as typeof options;
            },
        );
        const { rerender } = render(<Operations {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        );
        act(() => options.onStart?.());
        (document.activeElement as HTMLElement).blur();
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
        act(() => options.onFinish?.());

        expect(
            screen.getByRole('button', { name: 'Start Ana Cruz' }),
        ).toHaveFocus();
    });

    it('titles each focused view', () => {
        render(<Operations {...owner} {...data({ view: 'queue' })} />);

        expect(document.title).toBe('Queue - Operations');
    });

    it('lists active blocks and releases one', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    pages: {
                        queue: page(1),
                        blocks: page(1),
                        failures: page(0),
                    },
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
            screen.getByRole('button', { name: 'Release block on Bay 2' }),
        );
        expect(inertia.calls[0].url).toBe(
            '/owner/organizations/1/operations/blocks/k1/release',
        );
        // The released block leaves the list, so focus lands on the section heading.
        expect(
            screen.getByRole('heading', { name: 'Blocked resources' }),
        ).toHaveFocus();
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

    it('opens read-only booking details with the grace state, restores focus and keeps actions in the sheet', async () => {
        render(<Operations {...owner} {...data()} />);

        const trigger = screen.getByRole('button', {
            name: 'Booking details for Ana Cruz',
        });
        trigger.focus();
        fireEvent.click(trigger);
        const sheet = screen.getByRole('dialog', { name: 'Booking details' });

        expect(sheet).toHaveTextContent('Booked resource type');
        expect(sheet).toHaveTextContent('Wash bay');
        expect(sheet).toHaveTextContent('Current resource');
        expect(sheet).toHaveTextContent('ABC 123');
        expect(sheet).toHaveTextContent(
            'No-show can be confirmed from 10:15 AM, after the 15-minute grace period.',
        );
        expect(
            within(sheet).getByRole('button', {
                name: 'Assign resource for Ana Cruz',
            }),
        ).toBeInTheDocument();
        expect(
            within(sheet).getByRole('button', { name: 'Check in' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', {
                name: 'Mark Ana Cruz as a no-show',
            }),
        ).not.toBeInTheDocument();

        fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('says a booking is inside its grace period and offers no-show only after it', () => {
        const inGrace = row({
            noShowEligibleAt: '2026-10-05T02:15:00+00:00',
        });
        render(
            <Operations
                {...owner}
                {...data({
                    now: '2026-10-05T02:05:00+00:00',
                    queue: [inGrace],
                })}
            />,
        );

        expect(screen.getByRole('list', { name: 'Queue' })).toHaveTextContent(
            'In grace period until 10:15 AM',
        );
        const sheet = openDetails('Ana Cruz');
        expect(
            within(sheet).queryByRole('button', { name: /as a no-show/ }),
        ).not.toBeInTheDocument();
    });

    it('offers the no-show confirmation after grace, naming the grace and the late-arrival alternative', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    now: '2026-10-05T02:20:00+00:00',
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

        const sheet = openDetails('Ana Cruz');
        expect(sheet).toHaveTextContent(
            'A customer who arrives now is checked in as a late arrival',
        );
        fireEvent.click(
            within(sheet).getByRole('button', {
                name: 'Mark Ana Cruz as a no-show',
            }),
        );
        expect(
            screen.getByRole('dialog', { name: /no-show/ }),
        ).toHaveTextContent('The 15-minute grace period has passed');
    });

    it('marks a late arrival in the queue and the details', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    queue: [
                        row({
                            state: 'checked_in',
                            lateArrivalAt: '2026-10-05T02:40:00+00:00',
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

        expect(screen.getByRole('list', { name: 'Queue' })).toHaveTextContent(
            'Late arrival at 10:40 AM',
        );
        expect(openDetails('Ana Cruz')).toHaveTextContent('Late arrival');
    });

    it('starts from the details sheet and closes it once the request settles, so any rejection is visible on the page', () => {
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
                                reorder: false,
                            },
                        }),
                    ],
                })}
            />,
        );

        const sheet = openDetails('Ana Cruz');
        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Start service' }),
        );

        expect(inertia.calls[0].url).toBe(`${base}/start`);
        expect(
            screen.queryByRole('dialog', { name: 'Booking details' }),
        ).not.toBeInTheDocument();
    });
});

describe('Operations focused views', () => {
    beforeEach(() => {
        resetInertia();
        fakeEcho();
    });
    afterEach(() => {
        delete window.Echo;
    });

    it('hides sections outside the focused mobile view without removing the desktop workspace', () => {
        const { rerender } = render(
            <Operations {...owner} {...data({ view: 'queue' })} />,
        );
        expect(
            screen.getByRole('list', { name: 'Counts for the day' }),
        ).toHaveClass('max-lg:hidden');
        expect(
            screen.getByRole('region', { name: 'Queue and upcoming' }),
        ).not.toHaveClass('max-lg:hidden');

        rerender(<Operations {...owner} {...data({ view: 'dashboard' })} />);
        expect(
            screen.getByRole('list', { name: 'Counts for the day' }),
        ).not.toHaveClass('max-lg:hidden');
    });

    it('filters the queue from the queue view and keeps the date', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    view: 'queue',
                    day: { ...data().day, date: '2026-10-04' },
                })}
            />,
        );

        const group = screen.getByRole('group', { name: 'Filter the queue' });
        expect(
            within(group).getByRole('button', { name: 'All (2)' }),
        ).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(
            within(group).getByRole('button', { name: 'Checked in (1)' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            data: { date: '2026-10-04', view: 'queue', filter: 'checked_in' },
        });
    });

    it('lists the secondary destinations in More: Staff never see Billing or Settings, an Owner does', () => {
        const { rerender } = render(
            <Operations
                {...owner}
                viewer={{ role: 'staff', canManageOwnerAreas: false }}
                {...data({ view: 'more' })}
            />,
        );
        const more = screen.getByRole('navigation', {
            name: 'More destinations',
        });
        expect(
            within(more).getByRole('link', { name: 'Booking Requests' }),
        ).toHaveAttribute('href', owner.organization.bookingRequestsUrl);
        expect(
            within(more).getByRole('link', { name: /Conflicts/ }),
        ).toBeInTheDocument();
        expect(
            within(more).queryByRole('link', { name: /Billing/ }),
        ).not.toBeInTheDocument();
        expect(
            within(more).queryByRole('link', { name: /Settings/ }),
        ).not.toBeInTheDocument();

        rerender(<Operations {...owner} {...data({ view: 'more' })} />);
        expect(
            within(
                screen.getByRole('navigation', { name: 'More destinations' }),
            ).getByRole('link', { name: /Billing/ }),
        ).toHaveAttribute('href', BILLING_URL);
        expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute(
            'href',
            owner.organization.baseUrl,
        );
    });

    it('opens the walk-in sheet on arrival in the walk-in view', () => {
        render(<Operations {...owner} {...data({ view: 'walk-in' })} />);

        expect(
            screen.getByRole('form', { name: 'Add walk-in or booking' }),
        ).toBeInTheDocument();
    });
});

describe('Operations lists never hide work', () => {
    beforeEach(() => {
        resetInertia();
        fakeEcho();
    });
    afterEach(() => {
        delete window.Echo;
    });

    it('states the visible range of the whole result and moves between pages keeping the URL state', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    day: { ...data().day, date: '2026-10-04' },
                    view: 'queue',
                    filter: 'booked',
                    pages: {
                        queue: page(205, {
                            page: 2,
                            perPage: 200,
                            lastPage: 2,
                            from: 201,
                            to: 205,
                        }),
                        blocks: page(0),
                        failures: page(0),
                    },
                })}
            />,
        );

        const pager = screen.getByRole('navigation', {
            name: 'bookings pages',
        });
        expect(pager).toHaveTextContent('Showing 201–205 of 205 bookings');
        expect(
            within(pager).getByRole('button', { name: 'Next page' }),
        ).toBeDisabled();
        fireEvent.click(
            within(pager).getByRole('button', { name: 'Previous page' }),
        );

        expect(inertia.calls[0].data).toEqual({
            date: '2026-10-04',
            view: 'queue',
            filter: 'booked',
        });
    });

    it('pages blocks and failures independently of the queue', () => {
        render(
            <Operations
                {...owner}
                {...data({
                    pages: {
                        queue: page(1),
                        blocks: page(52, { perPage: 50, lastPage: 2, to: 50 }),
                        failures: page(0),
                    },
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

        fireEvent.click(
            within(
                screen.getByRole('navigation', { name: 'blocks pages' }),
            ).getByRole('button', { name: 'Next page' }),
        );

        expect(inertia.calls[0].data).toEqual({ blocks_page: 2 });
    });
});

describe('Operations realtime and offline recovery', () => {
    beforeEach(() => {
        resetInertia({}, '/owner/organizations/1/operations?view=queue');
    });
    afterEach(() => {
        vi.restoreAllMocks();
        delete window.Echo;
    });

    function setOnline(value: boolean) {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
        act(() => {
            window.dispatchEvent(new Event(value ? 'online' : 'offline'));
        });
    }

    it('subscribes to its organization channel only, refreshes on a nudge and never renders the payload', () => {
        const live = fakeEcho();
        const { unmount } = render(<Operations {...owner} {...data()} />);

        expect(live.echo.private).toHaveBeenCalledWith('operations.1');
        act(() => live.emit('.operations.changed'));

        const gets = inertia.calls.filter((call) => call.method === 'get');
        expect(gets).toHaveLength(1);
        expect(gets[0].url).toBe(
            '/owner/organizations/1/operations?view=queue',
        );
        expect(gets[0].options?.only).toEqual(
            expect.arrayContaining(['queue', 'stats', 'pages']),
        );

        unmount();
        expect(live.echo.leave).toHaveBeenCalledWith('operations.1');
    });

    it('waits for the member’s own write to finish before refreshing, then coalesces events into one reload', () => {
        const live = fakeEcho();
        render(<Operations {...owner} {...data()} />);
        const emitVisit = (event: string, method: string) =>
            act(() => {
                for (const listener of inertia.listeners[event] ?? []) {
                    listener({ detail: { visit: { method } } });
                }
            });

        emitVisit('start', 'post');
        act(() => {
            live.emit('.operations.changed');
            live.emit('.operations.changed');
            live.emit('.operations.changed');
        });
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);

        emitVisit('finish', 'post');
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
    });

    it('shows a paused-live state and catches up exactly once when the socket reconnects', () => {
        const live = fakeEcho();
        render(<Operations {...owner} {...data()} />);

        act(() => live.transition('unavailable', 'connected'));
        expect(screen.getByRole('status')).toHaveTextContent(
            'Live updates are paused',
        );
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);

        act(() => live.transition('connected', 'unavailable'));
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
        expect(
            screen.queryByText('Live updates are paused'),
        ).not.toBeInTheDocument();
    });

    it('disables every transaction offline with a persistent announcement, then re-enables after one catch-up', () => {
        fakeEcho();
        inertia.nextGet = 'pending';
        render(<Operations {...owner} {...data()} />);

        setOnline(false);
        expect(screen.getByRole('alert')).toHaveTextContent('Connection lost.');
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Changes are disabled while offline',
        );
        expect(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: 'Add walk-in' }),
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: 'Block a resource' }),
        ).toBeDisabled();
        // Nothing is queued for later.
        expect(
            inertia.calls.filter((call) => call.method === 'post'),
        ).toHaveLength(0);

        setOnline(true);
        expect(screen.getByRole('status')).toHaveTextContent('Back online.');
        expect(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        ).toBeDisabled();
        const gets = inertia.calls.filter((call) => call.method === 'get');
        expect(gets).toHaveLength(1);

        // The catch-up settles: transactions return.
        act(() => {
            (gets[0].options?.onFinish as (() => void) | undefined)?.();
        });
        expect(
            screen.getByRole('button', { name: 'Check in Ana Cruz' }),
        ).toBeEnabled();
    });

    it('keeps offline, stale revision and refresh failure as distinct states', () => {
        fakeEcho();
        inertia.props = {
            errors: {
                revision: 'This booking changed. Refresh and try again.',
            },
        };
        inertia.nextGet = 'network';
        render(<Operations {...owner} {...data()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        const alerts = screen
            .getAllByRole('alert')
            .map((alert) => alert.textContent);
        expect(
            alerts.some((text) => text?.includes('Queue may have changed.')),
        ).toBe(true);
        expect(
            alerts.some((text) => text?.includes('could not be refreshed')),
        ).toBe(true);
        expect(alerts.some((text) => text?.includes('Connection lost'))).toBe(
            false,
        );
    });
});
