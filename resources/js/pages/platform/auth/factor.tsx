import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { AuthCard } from '@/components/platform/auth-card';
import { SubmitButton } from '@/components/platform/submit-button';
import { Button } from '@/components/ui/button';

export default function Factor({ email }: { email: string }) {
    const [useRecovery, setUseRecovery] = useState(false);
    const form = useForm({ code: '', recovery_code: '' });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) =>
            useRecovery
                ? { recovery_code: data.recovery_code }
                : { code: data.code },
        );
        form.post('/platform/mfa', {
            onError: () => form.reset('code', 'recovery_code'),
        });
    }

    return (
        <AuthCard
            title="Second factor"
            description={`Signing in as ${email}. ${
                useRecovery
                    ? 'Enter one of your recovery codes. Each works once.'
                    : 'Enter the 6-digit code from your authenticator app.'
            }`}
        >
            <form onSubmit={submit} className="grid gap-4" noValidate>
                {useRecovery ? (
                    <TextField
                        label="Recovery code"
                        name="recovery_code"
                        autoComplete="off"
                        required
                        value={form.data.recovery_code}
                        onChange={(event) =>
                            form.setData('recovery_code', event.target.value)
                        }
                        error={form.errors.recovery_code}
                    />
                ) : (
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
                )}
                <SubmitButton
                    processing={form.processing}
                    disabled={
                        useRecovery
                            ? form.data.recovery_code.trim() === ''
                            : form.data.code.length !== 6
                    }
                    label="Verify and sign in"
                    pendingLabel="Verifying..."
                />
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="w-fit px-0"
                    onClick={() => {
                        form.reset();
                        form.clearErrors();
                        setUseRecovery(!useRecovery);
                    }}
                >
                    {useRecovery
                        ? 'Use my authenticator app instead'
                        : 'I lost my device: use a recovery code'}
                </Button>
            </form>
        </AuthCard>
    );
}
