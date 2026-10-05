import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import TenantShopShell from '@/layouts/tenant-shop-shell';
import Show from '@/pages/shops/show';
import Unavailable from '@/pages/shops/unavailable';
import { inertia, resetInertia } from '@/test/inertia';
import type { ShopPageProps } from '@/types/shop';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const props: ShopPageProps = {
    appName: 'Rinquo',
    shop: {
        name: 'Shine Auto Spa',
        tagline: 'Spotless every time',
        description: 'Hand wash and detailing.',
        brandColor: '#1E40AF',
        logo: null,
        hero: null,
        gallery: [],
    },
    branch: {
        name: 'Main',
        addressLine: '1 Rizal Ave',
        city: 'Manila',
        phone: '+63 2 1234 5678',
        timezone: 'Asia/Manila',
    },
    hours: {
        openNow: true,
        today: '8:00 AM - 6:00 PM',
        weekly: [{ day: 'Monday', label: '8:00 AM - 6:00 PM' }],
    },
    services: [
        {
            id: 1,
            name: 'Full wash',
            description: null,
            fromPriceCentavos: 35000,
            variants: [
                {
                    id: 1,
                    vehicleType: 'Sedan',
                    durationMinutes: 60,
                    priceCentavos: 35000,
                },
                {
                    id: 2,
                    vehicleType: 'SUV',
                    durationMinutes: 90,
                    priceCentavos: 50000,
                },
            ],
        },
    ],
    bookingAvailable: true,
    bookingUrl: '/shops/shine/book',
};

describe('Public shop page', () => {
    beforeEach(() => resetInertia(props));

    it('renders the branded catalog with duration, vehicles and a from price', () => {
        render(<Show {...props} />);

        // The hero headline is the tenant's own outcome statement (reference 01).
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Spotless every time',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Hand wash and detailing.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Full wash' }),
        ).toBeInTheDocument();
        expect(screen.getByText(/1 h - 1 h 30 min/)).toBeInTheDocument();
        expect(screen.getByText(/Sedan • SUV/)).toBeInTheDocument();
        expect(screen.getByText('From ₱350')).toBeInTheDocument();
        expect(screen.getAllByText('8:00 AM - 6:00 PM').length).toBeGreaterThan(
            0,
        );
    });

    it('offers Book now in the hero and a Select action per service', () => {
        render(<Show {...props} />);

        expect(screen.getByRole('link', { name: 'Book now' })).toHaveAttribute(
            'href',
            '/shops/shine/book',
        );
        expect(
            screen.getByRole('link', { name: 'Select Full wash' }),
        ).toHaveAttribute('href', '/shops/shine/book?service=1');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('says online booking is unavailable instead of offering dead controls when closed', () => {
        render(<Show {...props} bookingAvailable={false} />);

        expect(screen.getByRole('status')).toHaveTextContent(
            'Online booking unavailable',
        );
        expect(
            screen.queryByRole('link', { name: /book now|select/i }),
        ).not.toBeInTheDocument();
    });

    it('falls back gracefully without a hero photo or a phone number', () => {
        render(<Show {...props} branch={{ ...props.branch, phone: null }} />);

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /\+63/ }),
        ).not.toBeInTheDocument();
    });

    it('renders a hero image with its alt text when one exists', () => {
        render(
            <Show
                {...props}
                shop={{
                    ...props.shop,
                    hero: {
                        url: '/shops/shine/media/2',
                        altText: 'Our wash bay',
                    },
                }}
            />,
        );

        expect(
            screen.getByRole('img', { name: 'Our wash bay' }),
        ).toBeInTheDocument();
    });

    it('shows the open/closed state in the shell and exposes the tenant brand color', () => {
        const { container, rerender } = render(
            <TenantShopShell>content</TenantShopShell>,
        );

        // Wordmark with the shop name beneath it, as in the reference header.
        expect(screen.getByText('Rinquo')).toBeInTheDocument();
        expect(screen.getByText('Shine Auto Spa')).toBeInTheDocument();
        expect(screen.getByText('Open now')).toBeInTheDocument();
        expect(
            (container.firstElementChild as HTMLElement).style.getPropertyValue(
                '--tenant-brand',
            ),
        ).toBe('#1E40AF');

        inertia.props = { ...props, hours: { ...props.hours, openNow: false } };
        rerender(<TenantShopShell>content</TenantShopShell>);
        expect(screen.getByText('Closed now')).toBeInTheDocument();
    });
});

describe('Unavailable shop page', () => {
    beforeEach(() => resetInertia({ appName: 'Rinquo' }));

    it('is generic and carries no tenant details', () => {
        const { container } = render(
            <TenantShopShell>
                <Unavailable />
            </TenantShopShell>,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'This page is not available',
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/Open now|Closed now/),
        ).not.toBeInTheDocument();
        expect(container.querySelectorAll('img')).toHaveLength(0);
    });
});
