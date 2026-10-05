import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';
import {
    BOOKING_STEPS,
    StepIndicator,
} from '@/components/booking/step-indicator';

describe('StepIndicator', () => {
    it('is an ordered list with the current step marked and completed steps announced', () => {
        render(<StepIndicator steps={BOOKING_STEPS} current="schedule" />);
        const nav = screen.getByRole('navigation', {
            name: 'Booking progress',
        });
        const items = within(nav).getAllByRole('listitem');

        expect(items).toHaveLength(5);
        expect(items[2]).toHaveAttribute('aria-current', 'step');
        expect(items[0]).not.toHaveAttribute('aria-current');
        expect(items[0]).toHaveTextContent('Vehicle (completed)');
        expect(items[1]).toHaveTextContent('Service (completed)');
        expect(items[3]).not.toHaveTextContent('completed');
    });

    it('states the position in words for narrow screens', () => {
        render(<StepIndicator steps={BOOKING_STEPS} current="details" />);

        expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    });
});
