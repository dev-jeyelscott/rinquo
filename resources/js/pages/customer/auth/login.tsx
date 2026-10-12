import { Head, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CheckIcon,
    MailIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { OtpInput } from '@/components/booking/otp-input';
import { RinquoWordmark } from '@/components/customer/rinquo-wordmark';
import { TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { useFocusFirstInvalid } from '@/hooks/use-focus-first-invalid';
import { ALERT_TONES } from '@/lib/tones';

type Props = {
    step: 'email' | 'code';
    email: string | null;
    resendInSeconds: number;
    codeLength: number;
};

const LOGIN_URL = '/account/auth/login';
const CODE_URL = '/account/auth/code';
const VERIFY_URL = '/account/auth/verify';

/**
 * Neutral Rinquo customer sign-in with a six-digit email code (Spec 06 refs
 * 02-03). Resending and changing the address both use the existing code
 * request, so the server's per-email/IP limits and resend cooldown stay
 * authoritative and a failed send never claims a new code was delivered.
 */
export default function Login({
    step,
    email,
    resendInSeconds,
    codeLength,
}: Props) {
    const { props } = usePage();
    // "Use a different email" returns here without discarding the pending challenge until a new code is sent.
    const [changingEmail, setChangingEmail] = useState(false);
    const showCode = step === 'code' && email !== null && !changingEmail;

    return (
        <div className="flex min-h-screen flex-col bg-secondary/60 text-foreground">
            <Head title="Sign in to Rinquo" />
            <header className="border-b border-border bg-background">
                <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-4 sm:px-6 lg:min-h-[4.5rem]">
                    <RinquoWordmark appName={props.appName} href={LOGIN_URL} />
                </div>
            </header>
            <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-8 sm:px-6 md:content-center md:py-16 lg:grid-cols-2">
                <section className="rounded-2xl border bg-card p-6 shadow-xs sm:p-10">
                    {showCode ? (
                        <CodeStep
                            key={email}
                            email={email}
                            resendInSeconds={resendInSeconds}
                            codeLength={codeLength}
                            onChangeEmail={() => setChangingEmail(true)}
                        />
                    ) : (
                        <EmailStep
                            initialEmail={changingEmail ? (email ?? '') : ''}
                            onSent={() => setChangingEmail(false)}
                        />
                    )}
                </section>
                <aside className="hidden rounded-2xl bg-sidebar p-10 text-sidebar-foreground lg:grid lg:content-center lg:gap-4">
                    <p className="text-xs font-semibold tracking-widest text-sidebar-foreground/70 uppercase">
                        Why sign in?
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight">
                        Keep your car care organized.
                    </h2>
                    <p className="max-w-[52ch] text-sidebar-foreground/80">
                        Use your saved vehicles, view your verified online
                        bookings, and manage your profile from one neutral
                        Rinquo account.
                    </p>
                    <ul className="mt-2 grid gap-3">
                        {[
                            'One verified identity',
                            'Shared saved vehicles',
                            'Bookings across shops',
                        ].map((item) => (
                            <li key={item} className="flex items-center gap-3">
                                <CheckIcon
                                    aria-hidden="true"
                                    className="size-5 text-success"
                                />
                                {item}
                            </li>
                        ))}
                    </ul>
                </aside>
            </main>
        </div>
    );
}

function StepIntro({
    icon: Icon,
    eyebrow,
    title,
    children,
}: {
    icon: typeof MailIcon;
    eyebrow: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-3">
            <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"
            >
                <Icon className="size-6" />
            </span>
            <p className="mt-3 text-xs font-semibold tracking-widest text-primary uppercase">
                {eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{children}</p>
        </div>
    );
}

function EmailStep({
    initialEmail,
    onSent,
}: {
    initialEmail: string;
    onSent: () => void;
}) {
    const form = useForm({ email: initialEmail });
    const formElement = useRef<HTMLFormElement>(null);

    useFocusFirstInvalid(formElement, form.errors);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        form.post(CODE_URL, { onSuccess: onSent });
    }

    return (
        <div className="grid gap-6">
            <StepIntro
                icon={ShieldCheckIcon}
                eyebrow="Your Rinquo account"
                title="Sign in with email"
            >
                One verified account for participating wash and detailing shops.
            </StepIntro>
            <form
                ref={formElement}
                onSubmit={submit}
                className="grid gap-4"
                noValidate
            >
                <TextField
                    label="Email address"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    autoFocus={initialEmail !== ''}
                    value={form.data.email}
                    onChange={(event) =>
                        form.setData('email', event.target.value)
                    }
                    error={form.errors.email}
                    controlClassName="h-12 border-booking-control"
                />
                <Button
                    type="submit"
                    className="h-12"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : (
                        <ArrowRightIcon aria-hidden="true" />
                    )}
                    {form.processing
                        ? 'Sending code...'
                        : 'Send verification code'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    No password needed. We'll email a one-time verification
                    code.
                </p>
            </form>
        </div>
    );
}

function CodeStep({
    email,
    resendInSeconds,
    codeLength,
    onChangeEmail,
}: {
    email: string;
    resendInSeconds: number;
    codeLength: number;
    onChangeEmail: () => void;
}) {
    const verify = useForm({ code: '' });
    const resend = useForm({ email });
    // Bumped on each server-confirmed resend so an unchanged cooldown still restarts.
    const [sentCount, setSentCount] = useState(0);
    const remaining = useCountdown(resendInSeconds, sentCount);
    const [resent, setResent] = useState(false);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (verify.processing) {
            return;
        }
        setResent(false);
        verify.post(VERIFY_URL, { onError: () => verify.reset('code') });
    }

    function sendAgain() {
        if (resend.processing) {
            return;
        }
        setResent(false);
        resend.post(CODE_URL, {
            preserveScroll: true,
            onSuccess: () => {
                setResent(true);
                setSentCount((count) => count + 1);
                verify.reset('code');
                verify.clearErrors();
            },
        });
    }

    return (
        <div className="grid gap-6">
            <StepIntro
                icon={MailIcon}
                eyebrow="Step 2 of 2"
                title="Check your email"
            >
                Enter the six-digit verification code sent to{' '}
                <strong className="font-semibold text-foreground">
                    {email}
                </strong>
                .
            </StepIntro>
            <form onSubmit={submit} className="grid gap-4" noValidate>
                <OtpInput
                    value={verify.data.code}
                    onChange={(code) => verify.setData('code', code)}
                    length={codeLength}
                    label="Six-digit verification code"
                    error={verify.errors.code}
                    disabled={verify.processing}
                    autoFocus
                />
                <Button
                    type="submit"
                    className="h-12"
                    disabled={
                        verify.processing ||
                        verify.data.code.length !== codeLength
                    }
                    aria-busy={verify.processing}
                >
                    {verify.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {verify.processing ? 'Verifying...' : 'Verify code'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Only enter the code delivered to your email. Codes expire
                    after a few minutes and allow a limited number of tries.
                </p>
            </form>
            <div className="grid gap-3 border-t pt-5 text-sm">
                {resend.errors.email ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <AlertDescription>
                            {resend.errors.email}
                        </AlertDescription>
                    </Alert>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:h-11"
                        onClick={sendAgain}
                        disabled={remaining > 0 || resend.processing}
                        aria-busy={resend.processing}
                    >
                        {resend.processing ? 'Sending...' : 'Resend code'}
                    </Button>
                    <span className="text-muted-foreground">
                        {resent && remaining > 0
                            ? `A new code was sent. You can request another in ${remaining} seconds.`
                            : remaining > 0
                              ? `You can request another code in ${remaining} seconds.`
                              : 'You can request another code now.'}
                    </span>
                    {/* The visible countdown ticks every second, so only the start and the end are announced. */}
                    <span role="status" className="sr-only">
                        {remaining === 0
                            ? 'You can request another code now.'
                            : resent
                              ? 'A new code was sent.'
                              : ''}
                    </span>
                </div>
                <p className="text-muted-foreground">
                    Need a different address?{' '}
                    <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-11 p-0 align-baseline"
                        onClick={onChangeEmail}
                    >
                        Return to the email step
                    </Button>
                </p>
            </div>
        </div>
    );
}
