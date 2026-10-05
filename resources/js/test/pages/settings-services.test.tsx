import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Services from '@/pages/owner/settings/services';
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
        shopUrl: 'http://localhost/shops/shine',
        operationsUrl: '/owner/organizations/1/operations',
        conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
        unresolvedConflicts: 0,
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: BASE,
    },
    readiness: { isReady: false, items: [] },
};

const sedan = { id: 1, name: 'Sedan', isActive: true, archived: false };
const bay = { id: 5, name: 'Wash bay', largestCapacity: 2 };

const variant = {
    id: 9,
    vehicleTypeId: 1,
    vehicleTypeName: 'Sedan',
    priceCentavos: 35000,
    durationMinutes: 60,
    bufferMinutes: 10,
    isActive: true,
    archived: false,
    consumption: [] as { resourceTypeId: number; units: number }[],
    available: false,
    reasons: ['missing_consumption'],
};
const service = {
    id: 3,
    name: 'Full wash',
    description: '',
    isActive: true,
    archived: false,
    windows: [],
    variants: [variant],
};

function renderPage(over: Partial<React.ComponentProps<typeof Services>> = {}) {
    return render(
        <Services
            {...owner}
            vehicleTypes={[sedan]}
            services={[service]}
            addOns={[]}
            resourceTypes={[bay]}
            {...over}
        />,
    );
}

describe('Services settings', () => {
    beforeEach(() => resetInertia());

    it('shows empty states with creation actions when nothing is configured', () => {
        renderPage({ vehicleTypes: [], services: [], resourceTypes: [] });

        expect(
            screen.getAllByText(/No vehicle types yet/).length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/No services yet/).length).toBeGreaterThan(
            0,
        );
        expect(screen.getByText('No add-ons yet.')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Add vehicle type' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Add service' }),
        ).toBeInTheDocument();
    });

    it('warns that a variant without consumption is unavailable and says why', () => {
        renderPage();

        const card = screen.getByRole('group', { name: 'Full wash' });
        expect(within(card).getByText('Unavailable')).toBeInTheDocument();
        expect(
            within(card).getByRole('list', {
                name: /why full wash for sedan is unavailable/i,
            }),
        ).toHaveTextContent(/No resource consumption is set/);
    });

    it('shows a bookable variant without a warning', () => {
        renderPage({
            services: [
                {
                    ...service,
                    variants: [
                        {
                            ...variant,
                            available: true,
                            reasons: [],
                            consumption: [{ resourceTypeId: 5, units: 1 }],
                        },
                    ],
                },
            ],
        });

        expect(screen.getByText('Bookable')).toBeInTheDocument();
        expect(
            screen.queryByRole('list', { name: /why/i }),
        ).not.toBeInTheDocument();
    });

    it('submits money as integer centavos and shows field errors beside the field', () => {
        renderPage();
        inertia.nextErrors = {
            price_centavos: 'The price centavos field is required.',
        };
        const form = screen.getByRole('form', {
            name: 'Edit Full wash for Sedan',
        });

        fireEvent.change(within(form).getByLabelText(/price \(php\)/i), {
            target: { value: '350.50' },
        });
        fireEvent.click(
            within(form).getByRole('button', { name: 'Save variant' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'patch',
            url: `${BASE}/services/3/variants/9`,
            data: {
                price_centavos: 35050,
                duration_minutes: '60',
                buffer_minutes: '10',
                is_active: true,
            },
        });
        expect(within(form).getByLabelText(/price \(php\)/i)).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        expect(
            within(form).getByText('The price centavos field is required.'),
        ).toBeInTheDocument();
    });

    it('disables a form while it is saving', () => {
        renderPage();
        inertia.hold = true;
        const form = screen.getByRole('form', { name: 'Add a vehicle type' });

        fireEvent.change(within(form).getByLabelText(/new vehicle type/i), {
            target: { value: 'SUV' },
        });
        fireEvent.click(
            within(form).getByRole('button', { name: 'Add vehicle type' }),
        );

        expect(
            within(form).getByRole('button', { name: 'Saving...' }),
        ).toBeDisabled();
    });

    it('adds a consumption rule and saves it with positive integer units', () => {
        renderPage();
        const form = screen.getByRole('form', {
            name: 'Resource consumption for Full wash for Sedan',
        });

        fireEvent.click(
            within(form).getByRole('button', { name: 'Add resource' }),
        );
        fireEvent.change(
            within(form).getByRole('combobox', { name: /resource 1/ }),
            { target: { value: '5' } },
        );
        fireEvent.change(within(form).getByLabelText('Units used'), {
            target: { value: '2' },
        });
        fireEvent.click(
            within(form).getByRole('button', { name: 'Save consumption' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'put',
            url: `${BASE}/services/3/variants/9/consumption`,
            data: { rules: [{ resource_type_id: '5', units: '2' }] },
        });
    });

    it('explains how to proceed when no resource types exist', () => {
        renderPage({ resourceTypes: [] });

        const form = screen.getByRole('form', {
            name: 'Resource consumption for Full wash for Sedan',
        });
        expect(
            within(form).getByText(/Add a resource type with a resource/),
        ).toBeInTheDocument();
        expect(
            within(form).getByRole('button', { name: 'Add resource' }),
        ).toBeDisabled();
    });

    it('asks for confirmation before archiving and then posts to the archive endpoint', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Archive service Full wash' }),
        );
        const dialog = screen.getByRole('dialog', {
            name: /archive full wash/i,
        });
        expect(
            within(dialog).getByText(/history and id are kept/i),
        ).toBeInTheDocument();
        expect(inertia.calls).toHaveLength(0);

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Archive service' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: `${BASE}/services/3/archive`,
        });
    });

    it('lets the owner cancel an archive without sending anything', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Archive service Full wash' }),
        );
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(inertia.calls).toHaveLength(0);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows archived records as read-only', () => {
        renderPage({
            vehicleTypes: [{ ...sedan, archived: true }],
            services: [{ ...service, archived: true }],
        });

        expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
        expect(
            screen.queryByRole('form', { name: /Edit service/ }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Archive service/ }),
        ).not.toBeInTheDocument();
    });
});
