import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';

describe('SectionCard', () => {
    it('renders a titled group with description, badge and body', () => {
        render(
            <SectionCard
                role="group"
                aria-label="Wash bay"
                title="Wash bay"
                description="Physical resource"
                badge={<StatusChip tone="success">Active</StatusChip>}
            >
                <p>Body</p>
            </SectionCard>,
        );

        expect(
            screen.getByRole('group', { name: 'Wash bay' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 2, name: 'Wash bay' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Physical resource')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Body')).toBeInTheDocument();
    });

    it('supports a subordinate heading level and renders no body when empty', () => {
        const { container } = render(
            <SectionCard title="Full wash" headingLevel="h3">
                {null}
            </SectionCard>,
        );

        expect(
            screen.getByRole('heading', { level: 3, name: 'Full wash' }),
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-slot="card-content"]'),
        ).toBeNull();
    });
});

describe('StatusChip', () => {
    it('conveys meaning through its text and can be all caps', () => {
        render(
            <StatusChip tone="info" caps>
                Owner only
            </StatusChip>,
        );

        const chip = screen.getByText('Owner only');
        expect(chip).toHaveClass('uppercase', 'rounded-full');
    });
});
