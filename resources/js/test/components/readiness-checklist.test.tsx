import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ReadinessChecklist } from '@/components/owner/readiness-checklist';
import { resetInertia } from '@/test/inertia';
import type { ReadinessItem } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const items: ReadinessItem[] = [
    {
        key: 'profile',
        label: 'Public profile',
        passed: true,
        detail: 'All set.',
        tab: 'profile',
    },
    {
        key: 'hours',
        label: 'Business hours',
        passed: false,
        detail: 'Add at least one open weekly interval.',
        tab: 'hours',
    },
];

describe('ReadinessChecklist', () => {
    beforeEach(() => resetInertia());

    it('states pass and fail in text, not color alone', () => {
        render(
            <ReadinessChecklist
                items={items}
                baseUrl="/owner/organizations/1/settings"
            />,
        );

        const rows = within(
            screen.getByRole('list', { name: 'Readiness checklist' }),
        ).getAllByRole('listitem');
        expect(within(rows[0]).getByText('Passed')).toBeInTheDocument();
        expect(
            within(rows[1]).getByText('Needs attention'),
        ).toBeInTheDocument();
    });

    it('links only failing items to the tab that fixes them', () => {
        render(
            <ReadinessChecklist
                items={items}
                baseUrl="/owner/organizations/1/settings"
            />,
        );

        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(
            screen.getByRole('link', { name: /fix in hours/i }),
        ).toHaveAttribute('href', '/owner/organizations/1/settings/hours');
    });
});
