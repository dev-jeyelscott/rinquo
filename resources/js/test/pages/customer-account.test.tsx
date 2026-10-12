import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { accountDestination } from '@/layouts/customer-shell';
import Bookings from '@/pages/customer/bookings';
import Directory from '@/pages/customer/directory';
import Profile from '@/pages/customer/profile';
import Vehicles from '@/pages/customer/vehicles';
import { inertia, resetInertia } from '@/test/inertia';
import type { CustomerProfileProps, DirectoryShop } from '@/types/customer';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const shared = {
    appName: 'Rinquo',
    auth: { user: { email: 'ana@example.test' } },
    customer: { name: 'Ana Santos', emailVerified: true },
    flash: { status: null },
};

const shop: DirectoryShop = {
    name: 'Shine Wash & Detail',
    city: 'Quezon City',
    logo: null,
    cover: null,
    services: ['Exterior wash', 'Interior cleaning'],
    moreServices: 1,
    fromPriceCentavos: 18000,
    hours: ['Mon–Sat · 8:00 AM–7:00 PM'],
    url: '/shops/shine',
    bookingUrl: '/shops/shine/book',
};

const pageInfo = {
    page: 1,
    perPage: 20,
    total: 1,
    lastPage: 1,
    from: 1,
    to: 1,
};

function profileProps(
    emailChange: Partial<CustomerProfileProps['emailChange']> = {},
): CustomerProfileProps {
    return {
        profile: {
            name: 'Ana Santos',
            phone: '+63 917 123 4567',
            email: 'ana@example.test',
            emailVerified: true,
        },
        emailChange: { pendingEmail: null, changedTo: null, ...emailChange },
    };
}

describe('Customer account navigation', () => {
    it('gives exactly one destination per account URL, with Home and Book over the same directory route', () => {
        expect(accountDestination('/account/directory')).toBe('home');
        expect(accountDestination('/account/directory?view=book')).toBe('book');
        expect(accountDestination('/account/directory?q=Manila')).toBe('book');
        expect(accountDestination('/account/directory?q=')).toBe('home');
        expect(accountDestination('/account/bookings?page=2')).toBe('bookings');
        expect(accountDestination('/account/vehicles')).toBe('vehicles');
        expect(accountDestination('/account/profile')).toBe('profile');
    });

    it('renders five named mobile destinations, one current, plus a skip link and the account menu', () => {
        resetInertia(shared, '/account/directory?q=Quezon');
        render(<Directory query="Quezon" shops={[shop]} hasMore={false} />);

        const mobile = screen.getByRole('navigation', {
            name: 'Customer account mobile',
        });
        const links = within(mobile).getAllByRole('link');
        expect(links.map((link) => link.textContent)).toEqual([
            'Home',
            'Book',
            'Bookings',
            'Vehicles',
            'Profile',
        ]);
        expect(
            links.filter(
                (link) => link.getAttribute('aria-current') === 'page',
            ),
        ).toHaveLength(1);
        expect(
            within(mobile).getByRole('link', { name: 'Book' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(
                screen.getByRole('navigation', { name: 'Customer account' }),
            ).getByRole('link', { name: 'Book' }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            screen.getByRole('link', { name: 'Skip to main content' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Account menu for ana@example.test',
            }),
        ).toHaveTextContent('AS');
        expect(screen.getByText('Verified account')).toBeInTheDocument();
    });
});

describe('Customer directory', () => {
    beforeEach(() => resetInertia(shared, '/account/directory'));

    it('searches from the Home landing and previews listed shops', () => {
        render(<Directory query="" shops={[shop]} hasMore={false} />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Your car care, all in one place.',
            }),
        ).toBeInTheDocument();
        const searchbox = screen.getByRole('searchbox', {
            name: 'Search businesses by name or city',
        });
        expect(searchbox).toHaveAttribute(
            'placeholder',
            'Business name or city/municipality',
        );
        fireEvent.change(searchbox, { target: { value: ' Quezon ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Find a shop' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            url: '/account/directory',
            data: { q: 'Quezon' },
        });
        expect(
            screen.getByRole('link', { name: 'View directory' }),
        ).toHaveAttribute('href', '/account/directory?view=book');
    });

    it('shows the card facts and hands off to the shop’s own routes', () => {
        inertia.url = '/account/directory?view=book';
        render(<Directory query="" shops={[shop]} hasMore={false} />);

        const card = screen.getByRole('article', {
            name: 'Shine Wash & Detail',
        });
        expect(card).toHaveTextContent('Quezon City');
        expect(card).toHaveTextContent(
            'Exterior wash · Interior cleaning · +1 more',
        );
        expect(card).toHaveTextContent('Mon–Sat · 8:00 AM–7:00 PM');
        expect(card).toHaveTextContent('From ₱180');
        expect(card).toHaveTextContent('SW');
        expect(
            within(card).getByRole('link', {
                name: 'View shop: Shine Wash & Detail',
            }),
        ).toHaveAttribute('href', '/shops/shine');
        expect(
            within(card).getByRole('link', {
                name: 'Book at Shine Wash & Detail',
            }),
        ).toHaveAttribute('href', '/shops/shine/book');
    });

    it('distinguishes a valid zero-result search and clears it', () => {
        inertia.url = '/account/directory?q=Nowhere';
        render(<Directory query="Nowhere" shops={[]} hasMore={false} />);

        expect(
            screen.getByRole('heading', { name: 'No matching businesses' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'get',
            data: { view: 'book' },
        });
    });

    it('reports a failed search separately from an empty result and retries it', () => {
        inertia.url = '/account/directory?view=book';
        render(<Directory query="" shops={[shop]} hasMore={false} />);
        inertia.nextGet = 'network';
        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'Makati' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'We could not reach Rinquo',
        );
        expect(screen.getByRole('article')).toBeInTheDocument();
        inertia.nextGet = 'success';
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(inertia.calls[1]).toMatchObject({ data: { q: 'Makati' } });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says when the bounded list was truncated', () => {
        inertia.url = '/account/directory?view=book';
        render(<Directory query="" shops={[shop]} hasMore />);

        expect(
            screen.getByText(/Showing the first 1 businesses/),
        ).toBeInTheDocument();
    });
});

describe('Customer bookings', () => {
    beforeEach(() => resetInertia(shared, '/account/bookings'));

    it('explains the verified-only empty state and continues to the directory', () => {
        render(
            <Bookings
                bookings={[]}
                pageInfo={{ ...pageInfo, total: 0, from: 0, to: 0 }}
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: 'No verified online bookings yet',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /Staff-entered unverified bookings are not automatically linked/,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('link', { name: 'Find a shop' })[0],
        ).toHaveAttribute('href', '/account/directory?view=book');
    });

    it('shows shop origin, branch-local time and status text with a deep link', () => {
        render(
            <Bookings
                bookings={[
                    {
                        id: 'b-1',
                        shop: 'Shine',
                        city: 'Manila',
                        status: 'pending_approval',
                        scheduledAt: '2026-10-15T02:00:00+00:00',
                        timezone: 'Asia/Manila',
                        url: '/shops/shine/bookings/b-1',
                    },
                ]}
                pageInfo={pageInfo}
            />,
        );

        const row = screen
            .getByRole('link', { name: 'View booking at Shine' })
            .closest('li') as HTMLElement;
        expect(row).toHaveTextContent('Pending approval');
        expect(row).toHaveTextContent('Manila');
        expect(row).toHaveTextContent('10:00');
        expect(
            within(row).getByRole('link', { name: 'View booking at Shine' }),
        ).toHaveAttribute('href', '/shops/shine/bookings/b-1');
        expect(
            screen.getByRole('complementary', {
                name: 'Private across businesses',
            }),
        ).toBeInTheDocument();
    });
});

describe('Customer vehicles', () => {
    beforeEach(() => resetInertia(shared, '/account/vehicles'));

    const vehicles = [
        {
            id: 7,
            makeModel: 'Honda ADV 160',
            plate: 'ABC 1234',
            label: 'Daily ride',
        },
    ];

    it('confirms an archive, cancels without a request, then archives on the server', () => {
        render(<Vehicles vehicles={vehicles} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Archive Honda ADV 160' }),
        );
        const dialog = screen.getByRole('dialog', {
            name: 'Archive this vehicle?',
        });
        expect(dialog).toHaveTextContent(
            'Your existing bookings will not change.',
        );
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Keep vehicle' }),
        );
        expect(inertia.calls).toHaveLength(0);

        fireEvent.click(
            screen.getByRole('button', { name: 'Archive Honda ADV 160' }),
        );
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Archive vehicle',
            }),
        );
        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/account/vehicles/7/archive',
        });
    });

    it('moves focus to the page heading once the archived vehicle is gone', () => {
        const { rerender } = render(<Vehicles vehicles={vehicles} />);
        screen.getByRole('button', { name: 'Archive Honda ADV 160' }).focus();

        rerender(<Vehicles vehicles={[]} />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Saved vehicles' }),
        ).toHaveFocus();
    });

    it('adds a vehicle with labelled fields and shows server validation', () => {
        render(<Vehicles vehicles={vehicles} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

        expect(
            screen.getByRole('heading', { name: 'Add a vehicle' }),
        ).toHaveFocus();
        inertia.nextErrors = {
            make_model: 'Enter your vehicle make and model.',
        };
        fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
        expect(
            screen.getByLabelText(/Make and model/),
        ).toHaveAccessibleDescription(/Enter your vehicle make and model./);
        expect(screen.getByLabelText(/Make and model/)).toHaveFocus();
        expect(screen.getByLabelText(/Make and model/)).toHaveClass(
            'border-booking-control',
        );

        fireEvent.change(screen.getByLabelText(/Make and model/), {
            target: { value: 'Toyota Vios' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
        expect(inertia.calls[1]).toMatchObject({
            url: '/account/vehicles',
            data: { make_model: 'Toyota Vios', plate: '', label: '' },
        });
        expect(
            screen.getByRole('heading', { name: 'Your vehicles' }),
        ).toHaveFocus();
    });

    it('never implies a save when the connection drops', () => {
        render(<Vehicles vehicles={[]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add a vehicle' }));
        fireEvent.change(screen.getByLabelText(/Make and model/), {
            target: { value: 'Mazda 3' },
        });
        inertia.networkFailure = true;
        fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'the vehicle was not saved',
        );
        expect(
            screen.getByRole('heading', { name: 'Add a vehicle' }),
        ).toBeInTheDocument();
    });
});

describe('Customer profile', () => {
    beforeEach(() => resetInertia(shared, '/account/profile'));

    it('lets a long unbroken name wrap inside a shrinkable card (no page-wide scroll)', () => {
        const props = profileProps();
        props.profile.name = 'A'.repeat(200);
        render(<Profile {...props} />);

        const name = screen.getByRole('heading', {
            level: 2,
            name: 'A'.repeat(200),
        });
        expect(name).toHaveClass('[overflow-wrap:anywhere]');
        expect(name.closest('section')).toHaveClass('min-w-0');
    });

    it('edits name and phone with an explicit save', () => {
        render(<Profile {...profileProps()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Ana S.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(inertia.calls[0]).toMatchObject({
            method: 'patch',
            url: '/account/profile',
            data: { name: 'Ana S.', phone: '+63 917 123 4567' },
        });
        expect(
            screen.getByRole('heading', { level: 1, name: 'My profile' }),
        ).toHaveFocus();
    });

    it('requests a code for a new address while showing the current one', () => {
        render(<Profile {...profileProps()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Change email' }));

        expect(
            screen.getByText('ana@example.test', { selector: 'strong' }),
        ).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/New email address/), {
            target: { value: 'ana.new@example.test' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Send verification code' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            method: 'post',
            url: '/account/profile/email-change',
            data: { email: 'ana.new@example.test' },
        });
    });

    it('recovers from a rejected code without changing the address, using the existing request route', () => {
        render(
            <Profile
                {...profileProps({ pendingEmail: 'ana.new@example.test' })}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Verify your new email',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: 'Digit 1 of 6' }),
        ).toHaveFocus();
        inertia.nextErrors = {
            code: 'That code is invalid or has expired. Request a new code.',
        };
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Digit 1 of 6' }),
            {
                target: { value: '123456' },
            },
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Verify new email' }),
        );

        expect(
            screen.getByRole('heading', {
                name: 'That code could not be verified',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/No email address was changed/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Try code again' }),
        ).toBeDisabled();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a new code' }),
        );
        expect(inertia.calls[1]).toMatchObject({
            url: '/account/profile/email-change',
            data: { email: 'ana.new@example.test' },
        });
        expect(screen.getByRole('status')).toHaveTextContent(
            'A new code was sent',
        );
        expect(
            screen.queryByRole('heading', {
                name: 'That code could not be verified',
            }),
        ).not.toBeInTheDocument();
    });

    it('shows the verified change only after the server confirms it', () => {
        render(
            <Profile
                {...profileProps({ changedTo: 'ana.new@example.test' })}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Your email is verified' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/attempted to notify your previous/),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Return to profile' }),
        );
        expect(
            screen.getByRole('heading', { level: 1, name: 'My profile' }),
        ).toBeInTheDocument();
    });
});
