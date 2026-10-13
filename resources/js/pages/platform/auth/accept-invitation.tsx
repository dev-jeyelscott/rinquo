import { Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { UserPlusIcon } from 'lucide-react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';
import { useFocusFirstInvalid } from '@/components/platform/use-focus-first-invalid';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Props = { token: string; usable: boolean };

export default function AcceptInvitation({ token, usable }: Props) {
    const { ref, focusFirstInvalid } = useFocusFirstInvalid();
    const form = useForm({ name: '', password: '', password_confirmation: '' });

    const tokenError = (form.errors as Record<string, string>).token;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(`/platform/invitations/${token}`, {
            onError: () => {
                form.reset('password', 'password_confirmation');
                focusFirstInvalid();
            },
        });
    }

    if (!usable) {
        return (
            <AuthCard
                icon={UserPlusIcon}
                title="Invitation unavailable"
                description="This invitation is invalid, has expired, or was already used."
            >
                <p className="grid gap-3 text-sm">
                    Ask an administrator to send a new one.{' '}
                    <Link
                        href="/platform/login"
                        className="inline-flex w-fit items-center underline underline-offset-4 max-sm:min-h-11"
                    >
                        Back to sign in
                    </Link>
                </p>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            icon={UserPlusIcon}
            title="Accept your invitation"
            description="Choose your name and a password. Next you set up your authenticator."
        >
            <form ref={ref} onSubmit={submit} className="grid gap-4" noValidate>
                {tokenError ? (
                    <Alert variant="destructive">
                        <AlertDescription>{tokenError}</AlertDescription>
                    </Alert>
                ) : null}
                <TextField
                    controlClassName="max-sm:h-11"
                    label="Your name"
                    name="name"
                    autoComplete="name"
                    required
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    error={form.errors.name}
                />
                <TextField
                    controlClassName="max-sm:h-11"
                    label="Password"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    hint="At least 12 characters."
                    required
                    value={form.data.password}
                    onChange={(event) =>
                        form.setData('password', event.target.value)
                    }
                    error={form.errors.password}
                />
                <TextField
                    controlClassName="max-sm:h-11"
                    label="Confirm password"
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
                    label="Create account"
                    pendingLabel="Creating..."
                />
            </form>
        </AuthCard>
    );
}
