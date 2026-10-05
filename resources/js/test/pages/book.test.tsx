import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Book from '@/pages/shops/book';
import { T0900, T0915, T0930, wizardProps } from '@/test/fixtures/booking';
import { inertia, resetInertia } from '@/test/inertia';
import type { WizardPageProps } from '@/types/booking';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const scheduleProps: WizardPageProps = {
    ...wizardProps,
    selection: { vehicle: 1, service: 10, addOns: [], date: '2026-10-06' },
    availability: {
        date: '2026-10-06',
        closed: false,
        times: [
            { startAt: T0900, available: true },
            { startAt: T0915, available: false },
            { startAt: T0930, available: true },
        ],
    },
    nextAvailable: { startAt: T0900 },
};

function holdCalls() {
    return inertia.calls.filter((call) => call.method === 'post');
}

describe('Booking wizard', () => {
    beforeEach(() => resetInertia(wizardProps));

    it('walks vehicle, service and add-ons, with Continue disabled until a choice is made', () => {
        render(<Book {...wizardProps} />);

        const next = screen.getByRole('button', { name: 'Continue' });
        expect(next).toBeDisabled();
        expect(
            screen.getByRole('listitem', { current: 'step' }),
        ).toHaveTextContent('Vehicle');

        fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            screen.getByText('Choose a service for your Sedan'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: /Full wash/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /Wax/ }));

        // The running summary: price, service duration plus buffer, add-on included.
        const summary = screen.getByRole('complementary', {
            name: 'Booking summary',
        });
        expect(summary).toHaveTextContent('₱500');
        expect(summary).toHaveTextContent('1 h 20 min service + 10 min buffer');
        expect(summary).not.toHaveTextContent(/capacity/i);
    });

    it('shows a service per vehicle and tells the customer when nothing is offered', () => {
        render(<Book {...wizardProps} catalog={[]} />);

        expect(
            screen.getByText(
                'Online booking has no vehicles on offer right now.',
            ),
        ).toBeInTheDocument();
    });

    it('loads availability for the first open date when Schedule is reached', () => {
        render(
            <Book
                {...wizardProps}
                selection={{ vehicle: 1, service: 10, addOns: [], date: null }}
            />,
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            url: '/shops/shine/book',
            data: { vehicle: 1, service: 10, addOns: [], date: '2026-10-05' },
            options: {
                only: ['availability', 'nextAvailable'],
                preserveState: true,
            },
        });
    });

    it('preselects the service chosen on the storefront once its vehicle is picked', () => {
        render(
            <Book
                {...wizardProps}
                selection={{
                    vehicle: null,
                    service: 10,
                    addOns: [],
                    date: null,
                }}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByRole('radio', { name: /Full wash/ })).toBeChecked();
    });

    it('reloads availability when the date changes and shows the new times', () => {
        render(<Book {...scheduleProps} />);

        fireEvent.click(screen.getByRole('radio', { name: 'Mon, Oct 5' }));

        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'get',
            data: { vehicle: 1, service: 10, date: '2026-10-05' },
        });
    });

    it('holds the chosen time with a stable idempotency key and then continues', () => {
        render(<Book {...scheduleProps} />);

        const next = screen.getByRole('button', { name: 'Continue' });
        expect(next).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        expect(screen.getByText('Selected time')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const [first] = holdCalls();
        expect(first).toMatchObject({
            url: '/shops/shine/book/holds',
            data: {
                vehicle_type_id: 1,
                service_id: 10,
                add_on_ids: [],
                start_at: T0930,
            },
        });
        expect(first.data.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);

        // Retrying the same selection replays the same key; a different time starts a new one.
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(holdCalls()[1].data.idempotency_key).toBe(
            first.data.idempotency_key,
        );

        fireEvent.click(screen.getByRole('radio', { name: '9:00 AM' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(holdCalls()[2].data.idempotency_key).not.toBe(
            first.data.idempotency_key,
        );
    });

    it('explains a time that was just taken, drops the selection and refreshes the times', () => {
        render(<Book {...scheduleProps} />);
        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        inertia.nextErrors = {
            start_at: 'That time was just taken. Choose another time.',
        };
        const reloads = inertia.calls.filter(
            (call) => call.method === 'get',
        ).length;

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            screen.getByText('That time was just taken. Choose another time.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radio', { name: '9:30 AM' }),
        ).not.toBeChecked();
        expect(
            inertia.calls.filter((call) => call.method === 'get').length,
        ).toBe(reloads + 1);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('keeps the button busy while the hold is being placed', () => {
        render(<Book {...scheduleProps} />);
        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        inertia.hold = true;

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const busy = screen.getByRole('button', { name: /Holding your time/ });
        expect(busy).toBeDisabled();
        expect(busy).toHaveAttribute('aria-busy', 'true');
    });

    it('shows a failed load as an error with Retry that preserves the selection', () => {
        render(<Book {...scheduleProps} />);
        inertia.nextGet = 'error';
        fireEvent.click(screen.getByRole('radio', { name: 'Mon, Oct 5' }));

        expect(screen.getByText(/We couldn't load times/)).toBeInTheDocument();

        inertia.nextGet = 'success';
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(
            screen.queryByText(/We couldn't load times/),
        ).not.toBeInTheDocument();
        expect(inertia.calls.at(-1)).toMatchObject({
            data: { vehicle: 1, service: 10 },
        });
    });

    it('treats a network failure as offline and says nothing was reserved', () => {
        render(<Book {...scheduleProps} />);
        inertia.nextGet = 'network';

        fireEvent.click(screen.getByRole('radio', { name: 'Mon, Oct 5' }));

        expect(
            screen.getByText('You appear to be offline'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been reserved/),
        ).toBeInTheDocument();
    });

    it('notes that times are Philippine time and the booking rules', () => {
        render(<Book {...scheduleProps} />);

        expect(
            screen.getByText(
                /Times are Philippine time\. Book at least 1 h ahead, and up to 30 days out\./,
            ),
        ).toBeInTheDocument();
    });
});
