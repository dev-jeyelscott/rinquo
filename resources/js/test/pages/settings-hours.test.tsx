import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Hours from '@/pages/owner/settings/hours';
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
    readiness: { isReady: false, items: [] },
    entitlement: ACTIVE_ENTITLEMENT,
};

describe('Business hours settings', () => {
    beforeEach(() =>
        resetInertia(
            { organization: owner.organization, readiness: owner.readiness },
            `${BASE}/hours`,
        ),
    );

    it('starts empty and warns that the shop cannot be published', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        expect(screen.getByText(/No opening hours yet/)).toBeInTheDocument();
        expect(screen.getByText('No overrides.')).toBeInTheDocument();
    });

    it('owns exactly one "Settings · Hours" heading and no nested shell', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', { level: 1, name: 'Settings · Hours' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Primary mobile' }),
        ).not.toBeInTheDocument();
    });

    it('lists all seven days with a switch each and marks unset days closed', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 2, opensAt: '08:00', closesAt: '18:00' }]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        expect(screen.getAllByRole('switch')).toHaveLength(7);
        expect(
            screen.getByRole('switch', { name: 'Tuesday open' }),
        ).toBeChecked();
        expect(
            screen.getByRole('switch', { name: 'Sunday open' }),
        ).not.toBeChecked();
        expect(screen.getAllByText('Closed. No intervals.')).toHaveLength(6);
    });

    it('keeps the switch name stable and carries the state in checked', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        const sunday = screen.getByRole('switch', { name: 'Sunday open' });
        expect(sunday).not.toBeChecked();
        fireEvent.click(sunday);
        expect(
            screen.getByRole('switch', { name: 'Sunday open' }),
        ).toBeChecked();
        expect(screen.queryByRole('switch', { name: /closed/ })).toBeNull();
    });

    it('draws the off track with the full-strength muted-foreground token (3:1 non-text contrast)', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        const track = screen.getByRole('switch', { name: 'Sunday open' })
            .nextElementSibling as HTMLElement;
        expect(track.className).toMatch(/(^| )bg-muted-foreground( |$)/);
        expect(track.className).not.toMatch(/bg-muted-foreground\//);
    });

    it('opens a day with a default interval, edits it and submits server field names', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Monday open' }));
        expect(screen.getByLabelText('Monday starts')).toHaveValue('09:00');
        fireEvent.change(screen.getByLabelText('Monday starts'), {
            target: { value: '08:00' },
        });
        fireEvent.change(screen.getByLabelText('Monday ends'), {
            target: { value: '17:00' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'put',
            url: `${BASE}/hours`,
            data: {
                weekly: [{ weekday: 1, opens_at: '08:00', closes_at: '17:00' }],
                overrides: [],
            },
        });
    });

    it("closes a day by switching it off, which removes only that day's intervals", () => {
        render(
            <Hours
                {...owner}
                weekly={[
                    { weekday: 1, opensAt: '08:00', closesAt: '12:00' },
                    { weekday: 1, opensAt: '13:00', closesAt: '18:00' },
                    { weekday: 2, opensAt: '08:00', closesAt: '18:00' },
                ]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Monday open' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(inertia.calls[0].data.weekly).toEqual([
            { weekday: 2, opens_at: '08:00', closes_at: '18:00' },
        ]);
    });

    it('adds a second interval to one day with its own labelled fields', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 1, opensAt: '08:00', closesAt: '12:00' }]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Add Monday interval' }),
        );
        fireEvent.change(screen.getByLabelText('Monday interval 2 starts'), {
            target: { value: '13:00' },
        });
        fireEvent.change(screen.getByLabelText('Monday interval 2 ends'), {
            target: { value: '18:00' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(inertia.calls[0].data.weekly).toEqual([
            { weekday: 1, opens_at: '08:00', closes_at: '12:00' },
            { weekday: 1, opens_at: '13:00', closes_at: '18:00' },
        ]);
    });

    it('shows a compact summary row per day that reveals the intervals on demand', () => {
        render(
            <Hours
                {...owner}
                weekly={[
                    { weekday: 1, opensAt: '08:00', closesAt: '12:00' },
                    { weekday: 1, opensAt: '13:00', closesAt: '18:00' },
                ]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );
        const summary = screen.getByRole('button', {
            name: 'Monday intervals: 8:00 AM – 12:00 PM, 1:00 PM – 6:00 PM',
        });

        expect(summary).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'false');
    });

    it('maps a server error on the second interval to that interval and expands its day', () => {
        render(
            <Hours
                {...owner}
                weekly={[
                    { weekday: 1, opensAt: '08:00', closesAt: '12:00' },
                    { weekday: 1, opensAt: '13:00', closesAt: '09:00' },
                ]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );
        inertia.nextErrors = {
            'weekly.1.closes_at': 'The closes at must be after opens at.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(screen.getByLabelText('Monday interval 2 ends')).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        expect(screen.getByLabelText('Monday ends')).not.toHaveAttribute(
            'aria-invalid',
        );
        expect(
            screen.getByRole('button', { name: /^Monday intervals:/ }),
        ).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows per-interval validation errors next to the failing field', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 2, opensAt: '18:00', closesAt: '09:00' }]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );
        inertia.nextErrors = {
            'weekly.0.closes_at': 'The closes at must be after opens at.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(screen.getByLabelText('Tuesday ends')).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        expect(
            screen.getByText('The closes at must be after opens at.'),
        ).toBeInTheDocument();
    });

    it('shows an overlap error for the whole list', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 1, opensAt: '08:00', closesAt: '12:00' }]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );
        inertia.nextErrors = {
            weekly: 'Opening intervals on the same day cannot overlap.',
        };

        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );

        expect(screen.getByRole('alert')).toHaveTextContent('cannot overlap');
    });

    it('disables the time inputs of a closed date override and clears times on submit', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 1, opensAt: '08:00', closesAt: '17:00' }]}
                overrides={[
                    {
                        localDate: '2026-12-25',
                        isClosed: true,
                        opensAt: null,
                        closesAt: null,
                    },
                ]}
                branchTimezone="Asia/Manila"
            />,
        );

        expect(screen.getByLabelText('Override 1 opens')).toBeDisabled();
        fireEvent.click(
            screen.getByRole('button', { name: 'Save business hours' }),
        );
        expect(inertia.calls[0].data.overrides).toEqual([
            {
                local_date: '2026-12-25',
                is_closed: true,
                opens_at: null,
                closes_at: null,
            },
        ]);
    });

    it('removes an interval with an accessible control', () => {
        render(
            <Hours
                {...owner}
                weekly={[{ weekday: 1, opensAt: '08:00', closesAt: '17:00' }]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Remove Monday interval 1' }),
        );

        expect(
            within(document.body).getByText(/No opening hours yet/),
        ).toBeInTheDocument();
    });
});
