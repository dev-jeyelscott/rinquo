import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import PlanTerms from '@/pages/platform/plan-terms';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const current = { amountCentavos: 99900, trialDays: 14, graceDays: 3 };
const history = [
    {
        id: 1,
        amountCentavos: 99900,
        trialDays: 14,
        graceDays: 3,
        effectiveAt: '2026-10-01T00:00:00Z',
        reason: 'Initial terms',
        inForce: true,
    },
];

describe('Platform plan terms (Spec 07 references 20 and 21)', () => {
    beforeEach(() => resetInertia({ displayTimezone: 'Asia/Manila' }));

    function open() {
        render(
            <PlanTerms
                current={current}
                history={history as never}
                now="2026-10-05T00:00:00Z"
            />,
        );
    }

    it('shows the global summary, the guarantees and the published history', () => {
        open();

        expect(screen.getByText('One global monthly plan')).toBeInTheDocument();
        expect(screen.getByText('₱999')).toBeInTheDocument();
        expect(screen.getByText('All organizations')).toBeInTheDocument();
        expect(screen.getByText('What remains true')).toBeInTheDocument();
        expect(screen.getByText('Versioning')).toBeInTheDocument();
        expect(screen.getByText('In force')).toBeInTheDocument();
    });

    it('opens a confirm dialog with every field and keeps publishing disabled until step-up is complete', () => {
        open();
        fireEvent.click(
            screen.getByRole('button', { name: 'Publish new terms' }),
        );
        const publish = screen.getByRole('button', { name: 'Publish terms' });

        expect(screen.getByText('Confirm action')).toBeInTheDocument();
        for (const label of [
            /Monthly price/,
            /Trial days/,
            /Grace days/,
            /Effective from \(Manila time\)/,
            /Reason for the change/,
            /^Password/,
            /Authenticator code/,
        ]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
        expect(publish).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/^Password/), {
            target: { value: 'pw' },
        });
        fireEvent.change(screen.getByLabelText(/Authenticator code/), {
            target: { value: '123456' },
        });
        expect(publish).toBeEnabled();
        fireEvent.click(publish);
        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'post',
            url: '/platform/plan-terms',
        });
    });
});
