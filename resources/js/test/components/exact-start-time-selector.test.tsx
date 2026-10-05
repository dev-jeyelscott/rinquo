import { act, fireEvent, render, screen } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { ExactStartTimeSelector } from '@/components/booking/exact-start-time-selector';
import type { SelectorStatus } from '@/components/booking/exact-start-time-selector';
import type { DayAvailability, NextAvailable } from '@/types/booking';
import { T0900, T0915, T0930 } from '@/test/fixtures/booking';

const dates = [
    { date: '2026-10-05', closed: false },
    { date: '2026-10-06', closed: false },
    { date: '2026-10-07', closed: true },
];

const day: DayAvailability = {
    date: '2026-10-06',
    closed: false,
    times: [
        { startAt: T0900, available: true },
        { startAt: T0915, available: false },
        { startAt: T0930, available: true },
    ],
};

type Overrides = Partial<{
    status: SelectorStatus;
    availability: DayAvailability | null;
    selectedStart: string | null;
    nextAvailable: NextAvailable;
    nextKnown: boolean;
    phone: string | null;
}>;

function setup(overrides: Overrides = {}) {
    const handlers = {
        onDateChange: vi.fn(),
        onSelect: vi.fn(),
        onNextAvailable: vi.fn(),
        onRetry: vi.fn(),
    };
    const props = {
        dates,
        selectedDate: '2026-10-06',
        status: 'ready' as SelectorStatus,
        availability: day as DayAvailability | null,
        selectedStart: null as string | null,
        nextAvailable: { startAt: T0900 } as NextAvailable,
        nextKnown: true,
        timezone: 'Asia/Manila',
        phone: null as string | null,
        ...overrides,
        ...handlers,
    };
    const view = render(<ExactStartTimeSelector {...props} />);

    return { ...handlers, ...view, props };
}

describe('ExactStartTimeSelector', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('shows unavailable times visibly but disabled, with an accessible name that says so', () => {
        setup();

        expect(screen.getByRole('radio', { name: '9:00 AM' })).toBeEnabled();
        const taken = screen.getByRole('radio', {
            name: '9:15 AM, unavailable',
        });
        expect(taken).toBeDisabled();
        expect(taken).toHaveTextContent('9:15 AM');
    });

    it('selects an available time and announces it politely', () => {
        const { onSelect, rerender, props } = setup();

        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        expect(onSelect).toHaveBeenCalledWith(T0930);

        rerender(<ExactStartTimeSelector {...props} selectedStart={T0930} />);
        expect(screen.getByRole('radio', { name: '9:30 AM' })).toBeChecked();
        expect(
            screen.getByText('Selected 9:30 AM on Tue, Oct 6.'),
        ).toHaveAttribute('role', 'status');
    });

    it('does not select a disabled time', () => {
        const { onSelect } = setup();

        fireEvent.click(
            screen.getByRole('radio', { name: '9:15 AM, unavailable' }),
        );

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('moves focus between times with the arrow keys, skipping unavailable ones', () => {
        setup();
        const first = screen.getByRole('radio', { name: '9:00 AM' });
        first.focus();

        fireEvent.keyDown(first, { key: 'ArrowRight' });
        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(screen.getByRole('radio', { name: '9:30 AM' })).toHaveFocus();
    });

    it('picks a date, and a closed date is disabled and named closed', () => {
        const { onDateChange } = setup();

        fireEvent.click(screen.getByRole('radio', { name: 'Mon, Oct 5' }));
        expect(onDateChange).toHaveBeenCalledWith('2026-10-05');

        expect(
            screen.getByRole('radio', { name: 'Wed, Oct 7, closed' }),
        ).toBeDisabled();
    });

    it('jumps to the next available time', () => {
        const { onNextAvailable } = setup();

        fireEvent.click(screen.getByRole('button', { name: 'Next available' }));

        expect(onNextAvailable).toHaveBeenCalled();
    });

    it('shows no skeleton under 300 ms and a skeleton with a contextual message after it', () => {
        setup({ status: 'loading' });

        expect(
            screen.queryByText('Checking times…', { selector: 'p' }),
        ).not.toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(
            screen.getByText('Checking times…', { selector: 'p' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Checking times/ }),
        ).toBeDisabled();
    });

    it('explains a closed date and offers the next available time', () => {
        setup({
            availability: { date: '2026-10-07', closed: true, times: [] },
        });

        expect(
            screen.getByText('The shop is closed on Tue, Oct 6'),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('button', { name: 'Next available' }).length,
        ).toBeGreaterThan(0);
    });

    it('explains an open date with no times left', () => {
        setup({
            availability: { date: '2026-10-06', closed: false, times: [] },
        });

        expect(
            screen.getByText('No times left on Tue, Oct 6'),
        ).toBeInTheDocument();
    });

    it('explains when nothing is available in the whole window and offers the shop phone', () => {
        setup({
            availability: { date: '2026-10-06', closed: false, times: [] },
            nextAvailable: null,
            phone: '+63 2 1234 5678',
        });

        expect(
            screen.getByText('No times are available online right now'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '+63 2 1234 5678' }),
        ).toHaveAttribute('href', 'tel:+63212345678');
    });

    it('treats a failed load as an error with Retry, never as "no times"', () => {
        const { onRetry } = setup({ status: 'error' });

        expect(
            screen.getByText("We couldn't load times for Tue, Oct 6"),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been reserved/),
        ).toBeInTheDocument();
        expect(screen.queryByText(/No times left/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalled();
    });

    it('says plainly that nothing was reserved when offline', () => {
        setup({ status: 'offline' });

        expect(
            screen.getByText('You appear to be offline'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been reserved/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Retry' }),
        ).toBeInTheDocument();
    });
});
