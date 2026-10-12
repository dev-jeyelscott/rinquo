import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

function open(props: Partial<Parameters<typeof ConfirmAction>[0]> = {}) {
    render(
        <ConfirmAction
            label="Archive"
            ariaLabel="Archive Full wash"
            title="Archive this?"
            description="It is kept."
            confirmLabel="Archive it"
            url="/archive"
            {...props}
        />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Archive Full wash' }));

    return screen.getByRole('dialog');
}

describe('ConfirmAction', () => {
    beforeEach(() => resetInertia());

    it('closes once the request settles', () => {
        const dialog = open();
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Archive it' }),
        );

        expect(inertia.calls).toHaveLength(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the dialog open with a message after a dropped connection when asked to', () => {
        const dialog = open({
            networkErrorMessage: 'Refresh before retrying.',
        });
        inertia.nextPost = 'network';
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Archive it' }),
        );

        expect(screen.getByRole('dialog')).toHaveTextContent(
            'Refresh before retrying.',
        );
        expect(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Archive it',
            }),
        ).toBeEnabled();
    });

    it('keeps focus inside the dialog on the confirm button after a dropped connection', () => {
        const dialog = open({
            networkErrorMessage: 'Refresh before retrying.',
        });
        inertia.nextPost = 'network';
        (document.activeElement as HTMLElement).blur();
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Archive it' }),
        );

        expect(document.activeElement).toBe(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Archive it',
            }),
        );
    });

    it('keeps the legacy close-on-finish behaviour without a network message', () => {
        const dialog = open();
        inertia.nextPost = 'network';
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Archive it' }),
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('freezes the wording while open and explains a disabled confirmation inside the dialog', () => {
        const props = {
            label: 'Archive',
            ariaLabel: 'Archive Full wash',
            title: 'Archive this?',
            confirmLabel: 'Archive it',
            url: '/archive',
            disabledMessage: 'Paused.',
        };
        const { rerender } = render(
            <ConfirmAction {...props} description="Emailed 3:30 PM." />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Archive Full wash' }),
        );
        rerender(<ConfirmAction {...props} description="Emailed ." disabled />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Emailed 3:30 PM.');
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Paused.');
        expect(
            within(dialog).getByRole('button', { name: 'Archive it' }),
        ).toBeDisabled();
    });

    it('sends focus to the fallback target when the trigger is disabled on close', async () => {
        const target = document.createElement('h2');
        target.tabIndex = -1;
        document.body.append(target);
        const props = {
            label: 'Archive',
            ariaLabel: 'Archive Full wash',
            title: 'Archive this?',
            description: 'It is kept.',
            confirmLabel: 'Archive it',
            url: '/archive',
            returnFocus: () => target,
        };
        const { rerender } = render(<ConfirmAction {...props} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Archive Full wash' }),
        );
        rerender(<ConfirmAction {...props} disabled />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(document.activeElement).toBe(target));
        target.remove();
    });
});
