import { Head, router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { ownerRoutes } from '@/lib/routes';

type Props = {
    step: 'email' | 'code';
    email: string | null;
    resendInSeconds: number;
    codeLength: number;
    cooldownSeconds: number;
};

export default function Login({ step, email, resendInSeconds }: Props) {
    return (
        <>
            <Head title="Owner sign in" />
            <div className="mx-auto w-full max-w-md py-6">
                <Card className="rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle>
                            <h1 className="text-2xl">Owner sign in</h1>
                        </CardTitle>
                        <CardDescription>
                            {step === 'email'
                                ? 'We email you a one-time code. No password needed.'
                                : `Enter the 6-digit code we sent to ${email ?? 'your email'}.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {step === 'email' ? (
                            <EmailStep />
                        ) : (
                            <CodeStep
                                email={email ?? ''}
                                resendInSeconds={resendInSeconds}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function EmailStep() {
    const form = useForm({ email: '' });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(ownerRoutes.requestCode);
    }

    return (
        <form onSubmit={submit} className="grid gap-4" noValidate>
            <TextField
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={form.data.email}
                onChange={(event) => form.setData('email', event.target.value)}
                error={form.errors.email}
            />
            <Button
                type="submit"
                className="max-sm:h-11"
                disabled={form.processing}
                aria-busy={form.processing}
            >
                {form.processing ? (
                    <Spinner role="presentation" aria-hidden="true" />
                ) : null}
                {form.processing ? 'Sending code...' : 'Email me a code'}
            </Button>
        </form>
    );
}

function CodeStep({
    email,
    resendInSeconds,
}: {
    email: string;
    resendInSeconds: number;
}) {
    const verify = useForm({ code: '' });
    const resend = useForm({ email });
    const remaining = useCountdown(resendInSeconds);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        verify.post(ownerRoutes.verifyCode, {
            onError: () => verify.reset('code'),
        });
    }

    function sendAgain() {
        resend.post(ownerRoutes.requestCode, { preserveScroll: true });
    }

    return (
        <div className="grid gap-4">
            <form onSubmit={submit} className="grid gap-4" noValidate>
                <TextField
                    label="Sign-in code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={verify.data.code}
                    onChange={(event) =>
                        verify.setData(
                            'code',
                            event.target.value.replace(/\D/g, ''),
                        )
                    }
                    error={verify.errors.code}
                />
                <Button
                    type="submit"
                    className="max-sm:h-11"
                    disabled={
                        verify.processing || verify.data.code.length !== 6
                    }
                    aria-busy={verify.processing}
                >
                    {verify.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {verify.processing ? 'Verifying...' : 'Verify and sign in'}
                </Button>
            </form>
            {resend.errors.email ? (
                <Alert variant="destructive">
                    <AlertDescription>{resend.errors.email}</AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    onClick={sendAgain}
                    disabled={remaining > 0 || resend.processing}
                >
                    Resend code
                </Button>
                <span role="status" className="text-muted-foreground">
                    {remaining > 0
                        ? `You can request another code in ${remaining} seconds.`
                        : 'You can request another code now.'}
                </span>
            </div>
            <Button
                type="button"
                variant="link"
                size="sm"
                className="w-fit px-0"
                onClick={() => router.post(ownerRoutes.restart)}
            >
                Use a different email
            </Button>
        </div>
    );
}
