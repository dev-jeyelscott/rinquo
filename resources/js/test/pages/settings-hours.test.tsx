import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Hours from '@/pages/owner/settings/hours';
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
        baseUrl: BASE,
    },
    readiness: { isReady: false, items: [] },
};

describe('Business hours settings', () => {
    beforeEach(() => resetInertia());

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

    it('adds an interval, edits it and submits server field names', () => {
        render(
            <Hours
                {...owner}
                weekly={[]}
                overrides={[]}
                branchTimezone="Asia/Manila"
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add interval' }));
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
