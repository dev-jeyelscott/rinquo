import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';

type Props = { secret: string; otpauthUri: string; email: string };

export default function Enroll({ secret, otpauthUri, email }: Props) {
    const form = useForm({ code: '' });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post('/platform/enroll', { onError: () => form.reset('code') });
    }

    return (
        <AuthCard
            title="Set up your authenticator"
            description={`Every administrator signs in with a second factor. Add ${email} to an authenticator app, then confirm with a code.`}
        >
            <form onSubmit={submit} className="grid gap-4" noValidate>
                <div className="grid gap-1.5 rounded-lg border p-3 text-sm">
                    <p className="font-medium">Setup key</p>
                    <p
                        className="font-mono text-base break-all select-all"
                        data-testid="setup-key"
                    >
                        {secret}
                    </p>
                    <p className="text-muted-foreground">
                        Choose "enter a setup key" in your app (time-based, 6
                        digits). Or open{' '}
                        <a
                            href={otpauthUri}
                            className="underline underline-offset-4"
                        >
                            this link
                        </a>{' '}
                        on the device that has the app.
                    </p>
                </div>
                <TextField
                    label="Authenticator code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={form.data.code}
                    onChange={(event) =>
                        form.setData(
                            'code',
                            event.target.value.replace(/\D/g, ''),
                        )
                    }
                    error={form.errors.code}
                />
                <SubmitButton
                    processing={form.processing}
                    disabled={form.data.code.length !== 6}
                    label="Confirm and continue"
                    pendingLabel="Confirming..."
                />
            </form>
        </AuthCard>
    );
}
