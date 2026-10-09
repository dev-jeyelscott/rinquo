import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    selection: {
        vehicle: 1,
        service: 10,
        addOns: [],
        date: '2026-10-06',
        makeModel: 'Toyota Vios',
    },
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

function typeMakeModel(value = 'Toyota Vios') {
    fireEvent.change(screen.getByLabelText(/Make \/ model/), {
        target: { value },
    });
}

function holdCalls() {
    return inertia.calls.filter((call) => call.method === 'post');
}

describe('Booking wizard', () => {
    beforeEach(() => resetInertia(wizardProps));

    it('walks vehicle, make and model, service and add-ons, with Continue disabled until each is chosen', () => {
        render(<Book {...wizardProps} />);

        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        expect(
            screen.getByRole('listitem', { current: 'step' }),
        ).toHaveTextContent('Vehicle');

        fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        // A type alone is not enough: the make and model is required.
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        typeMakeModel('   ');
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        typeMakeModel('Toyota Vios');
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            screen.getByRole('group', { name: 'Choose your service' }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('Sedan · Toyota Vios').length,
        ).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: /Full wash/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /Wax/ }));

        // The running summary: price and service plus add-on duration, never buffer or capacity.
        const summary = screen.getByRole('complementary', {
            name: 'Booking summary',
        });
        expect(summary).toHaveTextContent('₱500');
        expect(summary).toHaveTextContent('1 h 20 min');
        expect(summary).toHaveTextContent('Sedan · Toyota Vios');
        expect(document.body).not.toHaveTextContent(
            /buffer|capacity|units|resource/i,
        );
    });

    it('resumes at Vehicle when a reload or deep link has no make and model, instead of failing at the hold', () => {
        render(
            <Book
                {...scheduleProps}
                selection={{ ...scheduleProps.selection, makeModel: null }}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'What are you bringing in?',
            }),
        ).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Sedan/ })).toBeChecked();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('offers a way back to Vehicle and moves focus to the error when the hold lacks a make and model', () => {
        render(<Book {...scheduleProps} />);
        inertia.nextErrors = {
            vehicle_make_model: 'Enter your vehicle make and model.',
        };
        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        );

        expect(
            screen
                .getByText('Enter your vehicle make and model.')
                .closest('[tabindex="-1"]'),
        ).toHaveFocus();
        fireEvent.click(
            screen.getByRole('button', { name: 'Enter vehicle details' }),
        );
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'What are you bringing in?',
            }),
        ).toHaveFocus();
    });

    it('titles every step with an h2 and moves focus to it when the step changes', () => {
        render(<Book {...wizardProps} />);
        // First render keeps the browser's own focus start.
        expect(document.body).toHaveFocus();

        fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        typeMakeModel();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Choose your service',
            }),
        ).toHaveFocus();
    });

    it('keeps the five stages in one ordered progress navigation with the action bar for the current step', () => {
        render(<Book {...wizardProps} />);

        const nav = screen.getByRole('navigation', {
            name: 'Booking progress',
        });
        expect(nav.querySelectorAll('li')).toHaveLength(5);
        const bar = screen.getByRole('group', { name: 'Booking actions' });
        expect(bar).toHaveTextContent('Step 1 of 5');
        expect(bar).toContainElement(
            screen.getByRole('button', { name: 'Continue' }),
        );
        expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
            'href',
            '/shops/shine',
        );
    });

    describe('saved vehicles', () => {
        const saved = [
            { id: 5, makeModel: 'Honda City', plate: 'RIN-007', label: null },
            { id: 6, makeModel: null, plate: 'OLD-111', label: null },
        ];

        function reachSchedule() {
            render(
                <Book
                    {...scheduleProps}
                    savedVehicles={saved}
                    selection={{
                        vehicle: null,
                        service: null,
                        addOns: [],
                        date: null,
                        makeModel: null,
                    }}
                />,
            );
            fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        }

        function continueToHold() {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            fireEvent.click(screen.getByRole('radio', { name: /Full wash/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Hold this time & continue',
                }),
            );
        }

        it('prefills the make and model from a saved vehicle and sends its id for the server to verify', () => {
            reachSchedule();
            fireEvent.click(screen.getByRole('radio', { name: /Honda City/ }));

            expect(screen.getByLabelText(/Make \/ model/)).toHaveValue(
                'Honda City',
            );
            continueToHold();

            expect(holdCalls()[0].data).toMatchObject({
                vehicle_make_model: 'Honda City',
                customer_vehicle_id: 5,
            });
        });

        it('stops sending the saved id once the customer types a different vehicle', () => {
            reachSchedule();
            fireEvent.click(screen.getByRole('radio', { name: /Honda City/ }));
            typeMakeModel('Mazda 3');
            expect(
                screen.getByRole('radio', { name: /Honda City/ }),
            ).not.toBeChecked();
            continueToHold();

            expect(holdCalls()[0].data).toMatchObject({
                vehicle_make_model: 'Mazda 3',
                customer_vehicle_id: null,
            });
        });

        it('prompts for make and model only on a bare legacy saved vehicle, not on one that has it', () => {
            reachSchedule();
            expect(screen.getByText('RIN-007')).toBeInTheDocument();
            expect(
                screen.queryByText('Enter its make and model below'),
            ).not.toBeInTheDocument();

            cleanup();
            render(
                <Book
                    {...wizardProps}
                    savedVehicles={[
                        {
                            id: 7,
                            makeModel: 'Kia Soluto',
                            plate: null,
                            label: null,
                        },
                        { id: 8, makeModel: null, plate: null, label: null },
                    ]}
                />,
            );
            expect(
                screen.getAllByText('Enter its make and model below'),
            ).toHaveLength(1);
        });

        it('still requires a make and model for a legacy saved vehicle that has none', () => {
            reachSchedule();
            fireEvent.click(
                screen.getByRole('radio', { name: /Saved vehicle/ }),
            );

            expect(screen.getByLabelText(/Make \/ model/)).toHaveValue('');
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeDisabled();
            typeMakeModel('Toyota Wigo');
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeEnabled();
        });
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
                selection={{
                    vehicle: 1,
                    service: 10,
                    addOns: [],
                    date: null,
                    makeModel: 'Toyota Vios',
                }}
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
                    makeModel: null,
                }}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: /Sedan/ }));
        typeMakeModel();
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

        const next = screen.getByRole('button', {
            name: 'Hold this time & continue',
        });
        expect(next).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        expect(screen.getByText('Selected time')).toBeInTheDocument();
        expect(
            screen.getByText('Exact planned service start'),
        ).toBeInTheDocument();
        fireEvent.click(next);

        const [first] = holdCalls();
        expect(first).toMatchObject({
            url: '/shops/shine/book/holds',
            data: {
                vehicle_type_id: 1,
                service_id: 10,
                add_on_ids: [],
                start_at: T0930,
                vehicle_make_model: 'Toyota Vios',
                customer_vehicle_id: null,
            },
        });
        expect(first.data.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);

        // Retrying the same selection replays the same key; a different time starts a new one.
        fireEvent.click(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        );
        expect(holdCalls()[1].data.idempotency_key).toBe(
            first.data.idempotency_key,
        );

        fireEvent.click(screen.getByRole('radio', { name: '9:00 AM' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        );
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

        fireEvent.click(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        );

        expect(
            screen.getByText('That time was just taken. Choose another time.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radio', { name: '9:30 AM' }),
        ).not.toBeChecked();
        expect(
            inertia.calls.filter((call) => call.method === 'get').length,
        ).toBe(reloads + 1);
        expect(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        ).toBeDisabled();
    });

    it('keeps the button busy while the hold is being placed', () => {
        render(<Book {...scheduleProps} />);
        fireEvent.click(screen.getByRole('radio', { name: '9:30 AM' }));
        inertia.hold = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Hold this time & continue' }),
        );

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
                /Times are Philippine time; book at least 1 h ahead, and up to 30 days out\./,
            ),
        ).toBeInTheDocument();
    });
});
