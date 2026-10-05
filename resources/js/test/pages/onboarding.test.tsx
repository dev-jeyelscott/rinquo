import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Onboarding from '@/pages/owner/onboarding';
import { inertia, resetInertia } from '@/test/inertia';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

describe('Onboarding', () => {
    beforeEach(() => resetInertia());

    it('starts empty with a suggested branch name and explains the timezone', () => {
        render(
            <Onboarding
                suggestedBranchName="Main branch"
                timezone="Asia/Manila"
            />,
        );

        expect(screen.getByLabelText(/business name/i)).toHaveValue('');
        expect(screen.getByLabelText(/branch name/i)).toHaveValue(
            'Main branch',
        );
        expect(screen.getByText(/Asia\/Manila/)).toBeInTheDocument();
    });

    it('suggests a shop address from the name until the owner edits it', () => {
        render(
            <Onboarding
                suggestedBranchName="Main branch"
                timezone="Asia/Manila"
            />,
        );

        fireEvent.change(screen.getByLabelText(/business name/i), {
            target: { value: 'Spark Auto Wash' },
        });
        expect(screen.getByLabelText(/shop address/i)).toHaveValue(
            'spark-auto-wash',
        );

        fireEvent.change(screen.getByLabelText(/shop address/i), {
            target: { value: 'My-Spark' },
        });
        fireEvent.change(screen.getByLabelText(/business name/i), {
            target: { value: 'Another Name' },
        });
        expect(screen.getByLabelText(/shop address/i)).toHaveValue('my-spark');
    });

    it('shows a slug conflict next to the field', () => {
        render(
            <Onboarding
                suggestedBranchName="Main branch"
                timezone="Asia/Manila"
            />,
        );
        inertia.nextErrors = { slug: 'This shop address is already taken.' };

        fireEvent.change(screen.getByLabelText(/business name/i), {
            target: { value: 'Taken' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Create organization' }),
        );

        expect(inertia.calls[0]).toMatchObject({
            url: '/owner/onboarding',
            data: { name: 'Taken', slug: 'taken', branch_name: 'Main branch' },
        });
        expect(
            screen.getByLabelText(/shop address/i),
        ).toHaveAccessibleDescription(/already taken/);
    });

    it('disables creation while the request is running', () => {
        render(
            <Onboarding
                suggestedBranchName="Main branch"
                timezone="Asia/Manila"
            />,
        );
        inertia.hold = true;

        fireEvent.click(
            screen.getByRole('button', { name: 'Create organization' }),
        );

        expect(
            screen.getByRole('button', { name: 'Creating...' }),
        ).toBeDisabled();
    });
});
