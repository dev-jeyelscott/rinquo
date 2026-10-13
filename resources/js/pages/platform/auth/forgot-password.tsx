import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { MailIcon } from 'lucide-react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';
import { useFocusFirstInvalid } from '@/components/platform/use-focus-first-invalid';

export default function ForgotPassword() {
    const { ref, focusFirstInvalid } = useFocusFirstInvalid();
    const form = useForm({ email: '' });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post('/platform/forgot-password', { onError: focusFirstInvalid });
    }

    return (
        <AuthCard
            icon={MailIcon}
            title="Reset your password"
            description="We email a link if the address belongs to an administrator. Resetting the password does not change your second factor."
        >
            <form ref={ref} onSubmit={submit} className="grid gap-4" noValidate>
                <TextField
                    controlClassName="max-sm:h-11"
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
                    className="inline-flex w-fit items-center text-sm underline underline-offset-4 max-sm:min-h-11"
                >
                    Back to sign in
                </Link>
            </form>
        </AuthCard>
    );
}
