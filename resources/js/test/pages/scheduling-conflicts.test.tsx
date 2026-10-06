import { fireEvent, render, screen, within } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import SchedulingConflicts from '@/pages/owner/scheduling-conflicts';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { ConflictRowData, ConflictsPageData } from '@/types/conflicts';
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
        unresolvedConflicts: 1,
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: '/owner/organizations/1/settings',
        billingUrl: BILLING_URL,
    },
    readiness: { isReady: true, items: [] },
    entitlement: ACTIVE_ENTITLEMENT,
};

function row(overrides: Partial<ConflictRowData> = {}): ConflictRowData {
    return {
        id: 'c1',
        status: 'open',
        resolution: null,
        cause: 'resource_blocked',
        detectedAt: '2026-10-05T00:00:00+00:00',
        resolvedAt: null,
        revision: 4,
        originalResource: 'Wash Bay 2',
        reassignedResource: null,
        booking: {
            id: 'b1',
            customerName: 'Juan Dela Cruz',
            customerPhone: '0917 111 2222',
            hasAccount: true,
            serviceName: 'Full Detailing',
            vehicleName: 'Toyota Vios',
            status: 'confirmed',
            startAt: '2026-10-07T06:30:00+00:00',
            serviceEndAt: '2026-10-07T08:30:00+00:00',
            durationMinutes: 120,
            bufferMinutes: 15,
        },
        proposal: null,
        lastOutcome: null,
        actions: { propose: true, withdraw: false },
        ...overrides,
    };
}

function data(overrides: Partial<ConflictsPageData> = {}): ConflictsPageData {
    return {
        now: '2026-10-05T01:00:00+00:00',
        timezone: 'Asia/Manila',
        counts: { needsProposal: 1, awaitingCustomer: 0, reassigned: 0 },
        unresolved: [row()],
        recent: [],
        selectedId: 'c1',
        candidates: {
            times: [
                {
                    startAt: '2026-10-07T07:30:00+00:00',
                    resource: 'Detailing Bay',
                },
                {
                    startAt: '2026-10-07T08:00:00+00:00',
                    resource: 'Detailing Bay',
                },
            ],
            error: null,
        },
        urls: {
            conflicts: '/owner/organizations/1/scheduling-conflicts',
            operations: '/owner/organizations/1/operations',
        },
        ...overrides,
    };
}

const base = '/owner/organizations/1/scheduling-conflicts/c1/proposal';

describe('Scheduling conflicts dashboard', () => {
    beforeEach(() => {
        resetInertia();
        // The hold countdown reads the clock: pin it to the page's server time.
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(new Date('2026-10-05T01:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('puts the protected original appointment and the cause first', () => {
        render(<SchedulingConflicts {...owner} {...data()} />);

        expect(
            screen.getByText('Booking cannot be fulfilled as scheduled'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Wash Bay 2 is blocked during this appointment/),
        ).toHaveTextContent('Same-time compatible reassignment failed.');
        const heading = screen.getByRole('heading', {
            name: 'Affected booking',
        });
        const card = heading.parentElement as HTMLElement;
        expect(card).toHaveTextContent('Juan Dela Cruz');
        expect(card).toHaveTextContent('Toyota Vios · Full Detailing');
        expect(card).toHaveTextContent('2:30 PM');
        expect(card).toHaveTextContent('Original slot remains reserved');
        expect(card).toHaveTextContent(
            'Duration snapshot: 120 min + 15 min buffer',
        );
        expect(
            screen.getByRole('list', { name: 'Conflict counts' }),
        ).toHaveTextContent('Needs proposal');
    });

    it('names the state in words in the queue and lists unresolved work first', () => {
        render(
            <SchedulingConflicts
                {...owner}
                {...data({
                    unresolved: [
                        row(),
                        row({
                            id: 'c2',
                            status: 'awaiting_customer',
                            proposal: {
                                id: 'p1',
                                startAt: '2026-10-07T07:30:00+00:00',
                                expiresAt: '2026-10-05T02:00:00+00:00',
                                resource: 'Detailing Bay',
                                lapsed: false,
                            },
                        }),
                    ],
                })}
            />,
        );

        const queue = screen.getByRole('list', {
            name: 'Unresolved conflicts',
        });
        expect(within(queue).getAllByRole('listitem')).toHaveLength(2);
        expect(queue).toHaveTextContent('Needs proposal');
        expect(queue).toHaveTextContent('Awaiting reply');
        expect(within(queue).getAllByRole('link')[0]).toHaveAttribute(
            'aria-current',
            'true',
        );
    });

    it('requires a chosen time and a confirmation before sending a proposal', () => {
        render(<SchedulingConflicts {...owner} {...data()} />);
        const send = screen.getByRole('button', {
            name: 'Send a reschedule proposal to Juan Dela Cruz',
        });
        expect(send).toBeDisabled();
        expect(
            screen.getByText(
                'Customer approval required before schedule changes.',
            ),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: /3:30 PM/ }));
        expect(send).toBeEnabled();
        fireEvent.click(send);

        const dialog = screen.getByRole('dialog', {
            name: 'Send the proposal to Juan Dela Cruz?',
        });
        expect(dialog).toHaveTextContent('stays reserved');
        expect(inertia.calls).toHaveLength(0);
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Send proposal' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: base,
            data: { revision: 4, start_at: '2026-10-07T07:30:00+00:00' },
        });
        expect(inertia.calls[0].data.idempotency_key).toMatch(/[0-9a-f-]{36}/);
    });

    it('shows the awaiting-customer state with a live hold, and withdraws deliberately', () => {
        render(
            <SchedulingConflicts
                {...owner}
                {...data({
                    unresolved: [
                        row({
                            status: 'awaiting_customer',
                            proposal: {
                                id: 'p1',
                                startAt: '2026-10-07T07:30:00+00:00',
                                expiresAt: '2026-10-05T01:28:00+00:00',
                                resource: 'Detailing Bay',
                                lapsed: false,
                            },
                            actions: { propose: true, withdraw: true },
                        }),
                    ],
                })}
            />,
        );

        const card = screen.getByRole('heading', { name: 'Customer response' })
            .parentElement?.parentElement as HTMLElement;
        expect(card).toHaveTextContent('Awaiting reply');
        expect(card).toHaveTextContent('3:30 PM');
        expect(card).toHaveTextContent(/Hold expires in \d+ min/);
        expect(card).toHaveTextContent('Original');
        expect(card).toHaveTextContent('reservation remains held');
        expect(
            screen.getByRole('button', {
                name: 'Replace the proposal to Juan Dela Cruz',
            }),
        ).toBeDisabled();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Withdraw the proposal to Juan Dela Cruz',
            }),
        );
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Withdraw proposal',
            }),
        );
        expect(inertia.calls[0]).toMatchObject({
            url: `${base}/withdraw`,
            data: { revision: 4 },
        });
    });

    it.each([
        ['declined', 'Declined', 'declined the proposed time'],
        ['expired', 'Expired', 'did not answer before the deadline'],
    ] as const)(
        'explains a %s proposal and that the conflict is back with staff',
        (status, chip, sentence) => {
            render(
                <SchedulingConflicts
                    {...owner}
                    {...data({
                        unresolved: [
                            row({
                                lastOutcome: {
                                    status,
                                    startAt: '2026-10-07T07:30:00+00:00',
                                    respondedAt: '2026-10-05T01:10:00+00:00',
                                },
                            }),
                        ],
                    })}
                />,
            );

            const card = screen.getByRole('heading', {
                name: 'Customer response',
            }).parentElement?.parentElement as HTMLElement;
            expect(card).toHaveTextContent(chip);
            expect(card).toHaveTextContent(sentence);
            expect(card).toHaveTextContent('The conflict is back with staff.');
        },
    );

    it('states empty, no-account and no-candidate situations truthfully', () => {
        const { unmount } = render(
            <SchedulingConflicts
                {...owner}
                {...data({
                    unresolved: [],
                    selectedId: null,
                    candidates: null,
                })}
            />,
        );
        expect(screen.getByText('No scheduling conflicts')).toBeInTheDocument();
        expect(
            screen.getByText('Nothing was resolved in the last 14 days.'),
        ).toBeInTheDocument();
        unmount();

        const noAccount = row();
        noAccount.booking = { ...noAccount.booking!, hasAccount: false };
        const second = render(
            <SchedulingConflicts
                {...owner}
                {...data({ unresolved: [noAccount] })}
            />,
        );
        expect(
            screen.getByText(/has no account to answer a proposal/),
        ).toBeInTheDocument();
        second.unmount();

        render(
            <SchedulingConflicts
                {...owner}
                {...data({ candidates: { times: [], error: null } })}
            />,
        );
        expect(
            screen.getByText(/No open times in the next 7 days/),
        ).toBeInTheDocument();
    });

    it('shows automatic same-time moves as resolved evidence without actions', () => {
        render(
            <SchedulingConflicts
                {...owner}
                {...data({
                    unresolved: [],
                    selectedId: 'c9',
                    candidates: null,
                    recent: [
                        row({
                            id: 'c9',
                            status: 'resolved',
                            resolution: 'same_time_reassigned',
                            reassignedResource: 'Wash Bay 1',
                            actions: { propose: false, withdraw: false },
                        }),
                    ],
                })}
            />,
        );

        expect(
            screen.getByText(
                'Moved from Wash Bay 2 to Wash Bay 1 at the same time. The customer was not contacted.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /proposal/i }),
        ).not.toBeInTheDocument();
    });

    it('explains a stale revision and refreshes the conflict', () => {
        resetInertia({
            errors: {
                revision: 'This conflict changed. Refresh and try again.',
            },
        });
        render(<SchedulingConflicts {...owner} {...data()} />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            'This conflict changed',
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Refresh the conflict' }),
        );
        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            data: { conflict: 'c1' },
        });
    });

    it('shows a skeleton while the conflict reloads', () => {
        resetInertia({ errors: { revision: 'Changed.' } });
        inertia.nextGet = 'pending';
        render(<SchedulingConflicts {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Refresh the conflict' }),
        );

        expect(screen.getByText('Loading the conflict')).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Affected booking' }),
        ).not.toBeInTheDocument();
    });

    it('offers a retry when the conflict could not be loaded', () => {
        resetInertia({ errors: { revision: 'Changed.' } });
        inertia.nextGet = 'network';
        render(<SchedulingConflicts {...owner} {...data()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Refresh the conflict' }),
        );

        expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Try again' }),
        ).toBeInTheDocument();
    });
});
