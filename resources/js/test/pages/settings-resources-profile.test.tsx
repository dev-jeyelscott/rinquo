import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Profile from '@/pages/owner/settings/profile';
import Resources from '@/pages/owner/settings/resources';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
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
        operationsUrl: '/owner/organizations/1/operations',
        conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
        unresolvedConflicts: 0,
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: BASE,
        billingUrl: BILLING_URL,
    },
    readiness: { isReady: false, items: [] },
    entitlement: ACTIVE_ENTITLEMENT,
};

describe('Resources settings', () => {
    beforeEach(() =>
        resetInertia(
            { organization: owner.organization, readiness: owner.readiness },
            `${BASE}/resources`,
        ),
    );

    it('shows an empty state with the creation form', () => {
        render(<Resources {...owner} resourceTypes={[]} />);

        expect(screen.getByText(/No resource types yet/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Add resource type' }),
        ).toBeInTheDocument();
    });

    it('owns exactly one "Settings · Resources" heading and no nested shell', () => {
        render(<Resources {...owner} resourceTypes={[]} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Settings · Resources',
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('navigation', { name: 'Primary mobile' }),
        ).not.toBeInTheDocument();
    });

    it('rejects non-positive capacity with the server error and keeps the form usable', () => {
        render(
            <Resources
                {...owner}
                resourceTypes={[
                    {
                        id: 5,
                        name: 'Wash bay',
                        isActive: true,
                        archived: false,
                        resources: [
                            {
                                id: 8,
                                name: 'Bay 1',
                                capacity: 2,
                                isActive: true,
                                archived: false,
                            },
                        ],
                    },
                ]}
            />,
        );
        inertia.nextErrors = {
            capacity: 'The capacity field must be at least 1.',
        };
        fireEvent.click(
            screen.getByRole('button', { name: 'Edit resource Bay 1' }),
        );
        const form = screen.getByRole('form', { name: 'Edit resource Bay 1' });

        fireEvent.change(within(form).getByLabelText(/capacity/i), {
            target: { value: '0' },
        });
        fireEvent.click(
            within(form).getByRole('button', { name: 'Save resource' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'patch',
            url: `${BASE}/resources/8`,
        });
        expect(within(form).getByLabelText(/capacity/i)).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        expect(within(form).getByLabelText(/capacity/i)).toHaveAttribute(
            'min',
            '1',
        );
    });

    it('hints that a type with no resources keeps variants unavailable', () => {
        render(
            <Resources
                {...owner}
                resourceTypes={[
                    {
                        id: 5,
                        name: 'Wash bay',
                        isActive: true,
                        archived: false,
                        resources: [],
                    },
                ]}
            />,
        );

        expect(
            screen.getByText(/Variants using this type stay unavailable/),
        ).toBeInTheDocument();
    });
});

describe('Resources split panel', () => {
    beforeEach(() =>
        resetInertia(
            { organization: owner.organization, readiness: owner.readiness },
            `${BASE}/resources`,
        ),
    );

    const types = [
        {
            id: 5,
            name: 'Wash bay',
            isActive: true,
            archived: false,
            resources: [
                {
                    id: 8,
                    name: 'Bay 1',
                    capacity: 2,
                    isActive: true,
                    archived: false,
                },
                {
                    id: 9,
                    name: 'Bay 2',
                    capacity: 1,
                    isActive: false,
                    archived: false,
                },
            ],
        },
        {
            id: 6,
            name: 'Detail bay',
            isActive: true,
            archived: false,
            resources: [],
        },
    ];

    it('lists resource types and a named-resources table with type, capacity and state', () => {
        render(<Resources {...owner} resourceTypes={types} />);

        const typeList = screen.getByRole('list', { name: 'Resource types' });
        expect(within(typeList).getByText('Wash bay')).toBeInTheDocument();
        expect(
            within(typeList).getByText(
                /No resources yet. Variants using this type stay unavailable/,
            ),
        ).toBeInTheDocument();

        const table = screen.getByRole('table', {
            name: 'Named physical resources',
        });
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map((h) => h.textContent),
        ).toEqual(['Resource', 'Type', 'Capacity', 'State', 'Actions']);
        const first = within(table).getByRole('row', { name: /Bay 1/ });
        expect(within(first).getByText('2 units')).toBeInTheDocument();
        expect(within(first).getByText('Active')).toBeInTheDocument();
        const second = within(table).getByRole('row', { name: /Bay 2/ });
        expect(within(second).getByText('1 unit')).toBeInTheDocument();
        expect(within(second).getByText('Inactive')).toBeInTheDocument();
    });

    it('opens the resource type editor from its row and archives only through confirmation', () => {
        render(<Resources {...owner} resourceTypes={types} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit resource type Wash bay' }),
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Archive resource type Wash bay',
            }),
        );

        expect(inertia.calls).toHaveLength(0);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('adds a resource to a chosen type and sends the type id', () => {
        render(<Resources {...owner} resourceTypes={types} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add resource' }));
        const form = screen.getByRole('form', {
            name: 'Add a physical resource',
        });
        fireEvent.change(within(form).getByLabelText(/Resource type/), {
            target: { value: '6' },
        });
        fireEvent.change(within(form).getByLabelText(/New resource name/), {
            target: { value: 'Bay 3' },
        });
        fireEvent.click(
            within(form).getByRole('button', { name: 'Add resource' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: `${BASE}/resources`,
            data: { resource_type_id: '6', name: 'Bay 3', capacity: '1' },
        });
    });

    it('disables Add resource until a resource type exists', () => {
        render(<Resources {...owner} resourceTypes={[]} />);

        expect(
            screen.getByRole('button', { name: 'Add resource' }),
        ).toBeDisabled();
    });

    it('shows archived records without an Edit action', () => {
        render(
            <Resources
                {...owner}
                resourceTypes={[{ ...types[0], archived: true }]}
            />,
        );

        expect(
            screen.queryByRole('button', { name: /Edit resource type/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Archived')).toBeInTheDocument();
    });
});

describe('Profile settings', () => {
    beforeEach(() =>
        resetInertia(
            { organization: owner.organization, readiness: owner.readiness },
            `${BASE}/profile`,
        ),
    );

    const profileProps = {
        ...owner,
        profile: {
            name: 'Shine',
            slug: 'shine',
            tagline: '',
            description: '',
            brandColor: '#1E40AF',
        },
        branch: {
            name: 'Main',
            addressLine: '',
            city: '',
            phone: '',
            timezone: 'Asia/Manila',
        },
        media: [],
        galleryLimit: 8,
    };

    it('shows validation errors for required public fields', () => {
        render(<Profile {...profileProps} />);
        inertia.nextErrors = {
            tagline: 'The tagline field is required.',
            city: 'The city field is required.',
        };

        fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

        expect(screen.getByLabelText(/tagline/i)).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        expect(
            screen.getByText('The city field is required.'),
        ).toBeInTheDocument();
    });

    it('owns one Settings · Profile heading and groups fields into three cards', () => {
        render(<Profile {...profileProps} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Settings · Profile',
            }),
        ).toBeInTheDocument();
        for (const title of ['Public profile', 'Branch information', 'Media']) {
            expect(
                screen.getByRole('heading', { level: 2, name: title }),
            ).toBeInTheDocument();
        }
        expect(screen.getByLabelText('Public shop URL')).toHaveValue(
            '/shops/shine',
        );
        expect(screen.getByLabelText('Timezone')).toHaveAttribute('readonly');
    });

    it('submits only the editable profile fields', () => {
        render(<Profile {...profileProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

        const call = inertia.calls.at(-1);
        expect(call?.method).toBe('patch');
        expect(call?.url).toBe(`${BASE}/profile`);
        expect(Object.keys(call?.data ?? {}).sort()).toEqual([
            'address_line',
            'branch_name',
            'brand_color',
            'city',
            'description',
            'name',
            'phone',
            'tagline',
        ]);
    });

    it('explains that photos are optional and that none are present', () => {
        render(<Profile {...profileProps} />);

        expect(
            screen.getByText(/Missing photos never block publishing/),
        ).toBeInTheDocument();
        expect(screen.getByText(/No photos yet/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Upload photo' }),
        ).toBeDisabled();
    });

    it('lists photos with alt text and an accessible remove control', () => {
        render(
            <Profile
                {...profileProps}
                media={[
                    {
                        id: 4,
                        kind: 'logo',
                        altText: 'Shine logo',
                        url: '/owner/organizations/1/settings/media/4',
                    },
                ]}
            />,
        );

        expect(
            screen.getByRole('img', { name: 'Shine logo' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Remove logo photo Shine logo',
            }),
        ).toBeInTheDocument();
    });
});
