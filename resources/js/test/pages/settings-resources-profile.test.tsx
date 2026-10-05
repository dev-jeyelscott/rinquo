import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Profile from '@/pages/owner/settings/profile';
import Resources from '@/pages/owner/settings/resources';
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
        bookingRequestsUrl: '/owner/organizations/1/booking-requests',
        baseUrl: BASE,
    },
    readiness: { isReady: false, items: [] },
};

describe('Resources settings', () => {
    beforeEach(() => resetInertia());

    it('shows an empty state with the creation form', () => {
        render(<Resources {...owner} resourceTypes={[]} />);

        expect(screen.getByText(/No resource types yet/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Add resource type' }),
        ).toBeInTheDocument();
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

describe('Profile settings', () => {
    beforeEach(() => resetInertia());

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
