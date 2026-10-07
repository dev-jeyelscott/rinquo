import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';

export default function ForgotPassword() {
    const form = useForm({ email: '' });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post('/platform/forgot-password');
    }

    return (
        <AuthCard
            title="Reset your password"
            description="We email a link if the address belongs to an administrator. Resetting the password does not change your second factor."
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
                <SubmitButton
                    processing={form.processing}
                    label="Email me a reset link"
                    pendingLabel="Sending..."
                />
                <Link
                    href="/platform/login"
                    className="w-fit text-sm underline underline-offset-4"
                >
                    Back to sign in
                </Link>
            </form>
        </AuthCard>
    );
}
