import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';
import { useFocusFirstInvalid } from '@/components/platform/use-focus-first-invalid';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Props = { signedOutReason: 'idle' | 'expired' | 'revoked' | null };

const REASONS: Record<string, string> = {
    idle: 'You were signed out after 30 minutes of inactivity.',
    expired: 'Your session reached its 12-hour limit. Sign in again.',
    revoked: 'Your access changed, so you were signed out. Sign in again.',
};

export default function Login({ signedOutReason }: Props) {
    const form = useForm({ email: '', password: '' });
    const { ref, focusFirstInvalid } = useFocusFirstInvalid();

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post('/platform/login', {
            onError: () => {
                form.reset('password');
                focusFirstInvalid();
            },
        });
    }

    return (
        <AuthCard
            icon={KeyRoundIcon}
            title="Platform sign in"
            description="Administrators only. You will be asked for your authenticator code next."
        >
            <form ref={ref} onSubmit={submit} className="grid gap-4" noValidate>
                {signedOutReason ? (
                    <Alert role="status">
                        <AlertDescription>
                            {REASONS[signedOutReason]}
                        </AlertDescription>
                    </Alert>
                ) : null}
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
                <TextField
                    controlClassName="max-sm:h-11"
                    label="Password"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    value={form.data.password}
                    onChange={(event) =>
                        form.setData('password', event.target.value)
                    }
                    error={form.errors.password}
                />
                <SubmitButton
                    processing={form.processing}
                    label="Continue"
                    pendingLabel="Checking..."
                />
                <Link
                    href="/platform/forgot-password"
                    className="inline-flex w-fit items-center text-sm underline underline-offset-4 max-sm:min-h-11"
                >
                    Forgot your password?
                </Link>
            </form>
        </AuthCard>
    );
}
