import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import BookingPolicy from '@/pages/owner/settings/booking-policy';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const BASE = '/owner/organizations/1/settings';
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
        baseUrl: BASE,
        billingUrl: BILLING_URL,
    },
    readiness: { isReady: true, items: [] },
    entitlement: ACTIVE_ENTITLEMENT,
};

const policy = {
    approvalMode: 'auto_confirm' as const,
    slotIntervalMinutes: 15,
    minNoticeMinutes: 90,
    horizonDays: 30,
    approvalWindowMinutes: 120,
};

describe('Booking policy settings', () => {
    beforeEach(() =>
        resetInertia(
            { organization: owner.organization, readiness: owner.readiness },
            `${BASE}/booking-policy`,
        ),
    );

    it('explains the consequence of each approval mode and hides the window until it matters', () => {
        render(<BookingPolicy {...owner} policy={policy} />);

        expect(
            screen.getByRole('radio', { name: /Confirm instantly/ }),
        ).toBeChecked();
        expect(
            screen.getByText(/You are not asked to approve anything/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/the request expires and the time is released/),
        ).toBeInTheDocument();
        expect(
            screen.queryByLabelText(/Approval response window/),
        ).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('radio', { name: /Approve each request/ }),
        );

        expect(screen.getByLabelText(/Approval response window/)).toHaveValue(
            120,
        );
    });

    it('owns exactly one "Settings · Booking Policy" heading and no nested shell', () => {
        render(<BookingPolicy {...owner} policy={policy} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Settings · Booking Policy',
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Primary mobile' }),
        ).not.toBeInTheDocument();
    });

    it('groups the rules into confirmation, scheduling and cancellation cards', () => {
        render(<BookingPolicy {...owner} policy={policy} />);

        for (const title of [
            'Confirmation mode',
            'Scheduling rules',
            'Cancellation and rescheduling',
        ]) {
            expect(
                screen.getByRole('heading', { level: 2, name: title }),
            ).toBeInTheDocument();
        }
        expect(screen.getByText(/Self-service cutoff/)).toBeInTheDocument();
    });

    it('shows the minimum notice as hours and minutes and submits integer minutes', () => {
        render(
            <BookingPolicy
                {...owner}
                policy={{ ...policy, approvalMode: 'staff_approval' }}
            />,
        );

        expect(screen.getByLabelText('Hours')).toHaveValue(1);
        expect(screen.getByLabelText('Minutes')).toHaveValue(30);

        fireEvent.change(screen.getByLabelText('Hours'), {
            target: { value: '2' },
        });
        fireEvent.change(screen.getByLabelText('Minutes'), {
            target: { value: '15' },
        });
        fireEvent.change(screen.getByLabelText(/Time slot interval/), {
            target: { value: '30' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Save booking policy' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'put',
            url: `${BASE}/booking-policy`,
            data: {
                approval_mode: 'staff_approval',
                slot_interval_minutes: 30,
                min_notice_minutes: 135,
                horizon_days: 30,
                approval_window_minutes: 120,
            },
        });
    });

    it('still submits the stored window when instant confirmation is chosen', () => {
        render(<BookingPolicy {...owner} policy={policy} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Save booking policy' }),
        );

        expect(inertia.calls[0].data).toMatchObject({
            approval_mode: 'auto_confirm',
            approval_window_minutes: 120,
        });
    });

    it('links server validation errors to their fields', () => {
        render(
            <BookingPolicy
                {...owner}
                policy={{ ...policy, approvalMode: 'staff_approval' }}
            />,
        );
        inertia.nextErrors = {
            horizon_days: 'The horizon days field must be between 1 and 365.',
            approval_window_minutes:
                'The approval window minutes field must be at least 15.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Save booking policy' }),
        );

        const horizon = screen.getByLabelText(/Booking horizon/);
        expect(horizon).toHaveAttribute('aria-invalid', 'true');
        expect(horizon).toHaveAccessibleDescription(
            expect.stringContaining('between 1 and 365'),
        );
        expect(
            screen.getByLabelText(/Approval response window/),
        ).toHaveAttribute('aria-invalid', 'true');
    });

    it('disables the submit button while saving', () => {
        render(<BookingPolicy {...owner} policy={policy} />);
        inertia.hold = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Save booking policy' }),
        );

        const busy = screen.getByRole('button', { name: /Saving/ });
        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
    });
});
