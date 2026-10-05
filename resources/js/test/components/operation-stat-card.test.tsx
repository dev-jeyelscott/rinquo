import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';
import { OperationStatCard } from '@/components/operations/operation-stat-card';

describe('OperationStatCard', () => {
    it('shows the label, the figure and an optional hint as text', () => {
        render(
            <OperationStatCard
                label="Appointments"
                value={12}
                tone="info"
                hint="3 not arrived"
            />,
        );

        expect(screen.getByText('Appointments')).toBeInTheDocument();
        expect(screen.getByText('12')).toHaveClass('tabular-nums');
        expect(screen.getByText('3 not arrived')).toBeInTheDocument();
    });

    it('omits the hint when there is none', () => {
        render(<OperationStatCard label="In service" value={0} />);

        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.queryByText(/not arrived/)).not.toBeInTheDocument();
    });
});
