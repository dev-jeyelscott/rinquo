import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ScheduleImpactDialog } from '@/components/owner/schedule-impact-dialog';
import { inertia, resetInertia } from '@/test/inertia';
import type { ScheduleImpact } from '@/types/conflicts';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

function impact(overrides: Partial<ScheduleImpact> = {}): ScheduleImpact {
    return {
        affected: 2,
        reassigned: 1,
        conflicts: 1,
        token: 'tok-1',
        preview: false,
        stale: false,
        truncated: 0,
        bookings: [
            {
                id: 'b1',
                customerName: 'Ana Cruz',
                serviceName: 'Full wash',
                startAt: '2026-10-05T02:00:00+00:00',
                timezone: 'Asia/Manila',
                outcome: 'reassigned',
                cause: 'resource_blocked',
                fromResource: 'Bay 1',
                toResource: 'Bay 2',
            },
            {
                id: 'b2',
                customerName: 'Ben Reyes',
                serviceName: 'Full wash',
                startAt: '2026-10-05T03:00:00+00:00',
                timezone: 'Asia/Manila',
                outcome: 'conflict',
                cause: 'resource_blocked',
                fromResource: 'Bay 1',
                toResource: null,
            },
        ],
        ...overrides,
    };
}

/** The user attempted a write; Inertia announces it before sending. */
function attempt(
    data: Record<string, unknown> = { reason: 'Drain' },
    method = 'post',
) {
    act(() => {
        for (const listener of inertia.listeners.before ?? []) {
            listener({
                detail: {
                    visit: {
                        method,
                        url: new URL(
                            'http://localhost/owner/organizations/1/operations/blocks',
                        ),
                        data,
                    },
                },
            });
        }
    });
}

function show(value: ScheduleImpact | null) {
    resetInertia({ flash: { status: null, schedulingImpact: value } });
}

describe('Schedule impact review', () => {
    beforeEach(() => show(null));

    it('renders nothing when no change is waiting for review', () => {
        render(<ScheduleImpactDialog />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('names the exact count and what happens to each booking, in words', () => {
        show(impact());
        render(<ScheduleImpactDialog />);

        const dialog = screen.getByRole('dialog', {
            name: '2 future bookings are affected',
        });
        expect(dialog).toHaveTextContent('1 stay at the same time');
        expect(dialog).toHaveTextContent('1 need staff action');
        expect(dialog).toHaveTextContent(
            'never moves an appointment time and never contacts a customer',
        );
        const list = within(dialog).getByRole('list', {
            name: 'Affected bookings',
        });
        expect(list).toHaveTextContent(
            'Moves from Bay 1 to Bay 2 at the same time',
        );
        expect(list).toHaveTextContent(
            'Needs a staff decision. The original time stays reserved.',
        );
        expect(list).toHaveTextContent('The resource is blocked');
        expect(list).toHaveTextContent('10:00 AM');
    });

    it('repeats the same submission with the server token on Apply changes', () => {
        show(impact());
        render(<ScheduleImpactDialog />);
        attempt({ reason: 'Drain', resource_id: 4 });

        fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

        expect(inertia.calls).toHaveLength(1);
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/owner/organizations/1/operations/blocks',
            data: { reason: 'Drain', resource_id: 4, impact_token: 'tok-1' },
        });
    });

    it('does not apply anything when the owner keeps current settings', () => {
        show(impact());
        render(<ScheduleImpactDialog />);
        attempt();

        fireEvent.click(
            screen.getByRole('button', { name: 'Keep current settings' }),
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(inertia.calls).toHaveLength(0);
    });

    it('says so when bookings changed and the plan was refreshed', () => {
        show(impact({ stale: true }));
        render(<ScheduleImpactDialog />);

        expect(
            screen.getByText(
                /Bookings changed since you last looked, so nothing was applied/,
            ),
        ).toBeInTheDocument();
    });

    it('offers a zero-impact review and truncated lists truthfully', () => {
        show(
            impact({
                affected: 0,
                reassigned: 0,
                conflicts: 0,
                bookings: [],
                preview: true,
            }),
        );
        const { unmount } = render(<ScheduleImpactDialog />);
        expect(
            screen.getByRole('dialog', {
                name: 'No future bookings are affected',
            }),
        ).toHaveTextContent('Nothing needs to move.');
        unmount();

        show(impact({ truncated: 12 }));
        render(<ScheduleImpactDialog />);
        expect(screen.getByRole('dialog')).toHaveTextContent('and 12 more');
    });

    it('cannot apply a review that is not connected to a submission', () => {
        show(impact());
        render(<ScheduleImpactDialog />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            'no longer connected to your change',
        );
        expect(
            screen.getByRole('button', { name: 'Apply changes' }),
        ).toBeDisabled();
    });
});
