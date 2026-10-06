import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Directory from '@/pages/customer/directory';
import Bookings from '@/pages/customer/bookings';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('Customer account pages', () => {
    beforeEach(() => resetInertia({ appName: 'Rinquo' }, '/account/directory'));

    it('searches the neutral directory and enters the selected shop', () => {
        render(
            <Directory
                query=""
                shops={[
                    {
                        name: 'Shine',
                        city: 'Manila',
                        url: '/shops/shine',
                    },
                ]}
            />,
        );

        fireEvent.change(
            screen.getByRole('textbox', {
                name: 'Search businesses by name or city',
            }),
            { target: { value: 'Manila' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            url: '/account/directory',
            data: { q: 'Manila' },
        });
        expect(screen.getByRole('link', { name: 'View shop' })).toHaveAttribute(
            'href',
            '/shops/shine',
        );
        expect(
            screen.getByRole('navigation', { name: 'Customer account' }),
        ).toBeInTheDocument();
    });

    it('distinguishes an empty booking history and continues to the directory', () => {
        inertia.url = '/account/bookings';
        const { container } = render(<Bookings bookings={[]} />);

        expect(
            container.querySelector('[data-slot="card-content"]'),
        ).toHaveTextContent(
            'You do not have any verified online bookings yet.',
        );
        expect(
            screen.getByRole('link', { name: 'Find a shop' }),
        ).toHaveAttribute('href', '/account/directory');
    });
});
