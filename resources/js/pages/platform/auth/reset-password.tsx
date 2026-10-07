import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const form = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post('/platform/reset-password', {
            onError: () => form.reset('password', 'password_confirmation'),
        });
    }

    return (
        <AuthCard
            title="Choose a new password"
            description="At least 12 characters. You will still need your authenticator code to sign in."
        >
            <form onSubmit={submit} className="grid gap-4" noValidate>
                <TextField
                    label="Email address"
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                    value={form.data.email}
                    onChange={(event) =>
                        form.setData('email', event.target.value)
                    }
                    error={form.errors.email}
                />
                <TextField
                    label="New password"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    value={form.data.password}
                    onChange={(event) =>
                        form.setData('password', event.target.value)
                    }
                    error={form.errors.password}
                />
                <TextField
                    label="Confirm new password"
                    type="password"
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                    value={form.data.password_confirmation}
                    onChange={(event) =>
                        form.setData(
                            'password_confirmation',
                            event.target.value,
                        )
                    }
                />
                <SubmitButton
                    processing={form.processing}
                    label="Change password"
                    pendingLabel="Changing..."
                />
            </form>
        </AuthCard>
    );
}
