import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { SETTINGS_SECTIONS } from '@/components/owner/settings-sections';
import { resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const BASE = '/owner/organizations/1/settings';
const props = {
    organization: { baseUrl: BASE },
    readiness: {
        isReady: false,
        items: [
            { key: 'a', label: 'A', passed: false, detail: '', tab: 'hours' },
        ],
    },
};

describe('Settings page heading', () => {
    beforeEach(() => resetInertia(props, `${BASE}/hours`));

    it('renders one page-owned h1 reading Settings · Section with the description', () => {
        render(<SettingsPageHeader section="hours" />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', { level: 1, name: 'Settings · Hours' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Weekly opening hours and date-specific overrides.',
            ),
        ).toBeInTheDocument();
    });

    it('links back to the Settings index for small screens', () => {
        render(<SettingsPageHeader section="hours" />);

        expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
            'href',
            BASE,
        );
    });

    it('offers seven navigation links with only the current route marked', () => {
        render(<SettingsPageHeader section="hours" />);
        const nav = screen.getByRole('navigation', { name: 'Settings' });
        const links = within(nav).getAllByRole('link');

        expect(links).toHaveLength(SETTINGS_SECTIONS.length);
        expect(
            links.filter(
                (link) => link.getAttribute('aria-current') === 'page',
            ),
        ).toHaveLength(1);
        expect(
            within(nav).getByRole('link', { name: /^Hours/ }),
        ).toHaveAttribute('aria-current', 'page');
        expect(
            within(nav).getByLabelText('Needs attention'),
        ).toBeInTheDocument();
        expect(within(nav).queryByRole('tab')).not.toBeInTheDocument();
    });
});
