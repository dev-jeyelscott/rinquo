import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import Welcome from '@/pages/welcome';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    usePage: () => ({
        props: {
            appName: 'Rinquo',
            displayTimezone: 'Asia/Manila',
            realtime: {
                key: 'test-key',
                host: 'localhost',
                port: 80,
                scheme: 'http',
            },
        },
    }),
}));

describe('Welcome shell page', () => {
    it('renders the product name as the page heading', () => {
        render(<Welcome />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Rinquo' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('The application foundation is running.'),
        ).toBeInTheDocument();
    });
});
