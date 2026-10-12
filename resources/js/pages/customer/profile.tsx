import { Head, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CheckIcon,
    ChevronRightIcon,
    CircleAlertIcon,
    GlobeIcon,
    InfoIcon,
    MailIcon,
    PencilIcon,
    PhoneIcon,
    ShieldCheckIcon,
    UserRoundIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { OtpInput } from '@/components/booking/otp-input';
import { AccountInfoPanel } from '@/components/customer/account-info-panel';
import { AccountPageHeader } from '@/components/customer/account-page-header';
import { AccountStateCard } from '@/components/customer/account-state-card';
import { TextField } from '@/components/owner/form-field';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFocusFirstInvalid } from '@/hooks/use-focus-first-invalid';
import CustomerShell from '@/layouts/customer-shell';
import { ALERT_TONES } from '@/lib/tones';
import type { CustomerProfileProps } from '@/types/customer';

type Mode = 'view' | 'edit' | 'email' | 'code' | 'changed';

const SHARED_NOTE =
    'Changes here update your shared customer profile, not any shop’s operational records.';
const OFFLINE =
    'We could not reach Rinquo. Nothing was changed; check your connection and try again.';

function initialMode({ emailChange }: CustomerProfileProps): Mode {
    if (emailChange.changedTo) {
        return 'changed';
    }

    return emailChange.pendingEmail ? 'code' : 'view';
}

function initials(name: string, email: string): string {
    const words = name.split(/\s+/).filter(Boolean);

    return (
        words.length > 0
            ? words
                  .slice(0, 2)
                  .map((word) => word.charAt(0))
                  .join('')
            : email.charAt(0)
    ).toUpperCase();
}

/**
 * One shared Rinquo profile (Spec 06 refs 12-17, Decision 169). Name and phone
 * use an explicit save. The account email changes only after a code sent to
 * the new address is verified; the current address stays active until then
 * and the previous address is notified after the change.
 */
export default function Profile(props: CustomerProfileProps) {
    const { profile, emailChange } = props;
    const [mode, setMode] = useState<Mode>(() => initialMode(props));
    const pageHeading = useRef<HTMLHeadingElement>(null);
    const previousMode = useRef(mode);

    // Leaving a panel (saved, cancelled, done) unmounts the control that had focus; land on the page heading.
    useEffect(() => {
        if (mode === 'view' && previousMode.current !== 'view') {
            pageHeading.current?.focus();
        }
        previousMode.current = mode;
    }, [mode]);

    // A server-confirmed change or a newly pending challenge decides the state; nothing is assumed locally.
    const { changedTo, pendingEmail } = emailChange;
    useEffect(() => {
        setMode(changedTo ? 'changed' : pendingEmail ? 'code' : 'view');
    }, [changedTo, pendingEmail]);

    const header: Record<Mode, [string, string]> = {
        view: ['My profile', 'Manage your shared Rinquo account information.'],
        edit: ['Edit profile', 'Changes apply to your shared Rinquo account.'],
        email: ['Change email', 'Protecting your shared customer identity.'],
        code: [
            'Verify your new email',
            'Finish securely before the account address changes.',
        ],
        changed: [
            'Email address updated',
            'Your verified Rinquo identity is preserved.',
        ],
    };

    return (
        <CustomerShell>
            <Head title={header[mode][0]} />
            <div className="grid gap-6">
                <AccountPageHeader
                    headingRef={pageHeading}
                    title={header[mode][0]}
                    description={header[mode][1]}
                />
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
                    {mode === 'view' ? (
                        <>
                            <ProfileSummary
                                profile={profile}
                                pendingEmail={emailChange.pendingEmail}
                                onEdit={() => setMode('edit')}
                                onContinueEmail={() => setMode('code')}
                            />
                            <div className="grid gap-5">
                                <AccountSecurity
                                    onChangeEmail={() => setMode('email')}
                                />
                                <AccountInfoPanel
                                    icon={GlobeIcon}
                                    title="One account, multiple shops"
                                >
                                    {SHARED_NOTE}
                                </AccountInfoPanel>
                            </div>
                        </>
                    ) : (
                        <>
                            {mode === 'edit' ? (
                                <EditProfile
                                    profile={profile}
                                    onDone={() => setMode('view')}
                                />
                            ) : mode === 'email' ? (
                                <RequestEmailChange
                                    currentEmail={profile.email}
                                    initialEmail={
                                        emailChange.pendingEmail ?? ''
                                    }
                                    onCancel={() => setMode('view')}
                                    onSent={() => setMode('code')}
                                />
                            ) : mode === 'code' && emailChange.pendingEmail ? (
                                <VerifyEmailChange
                                    pendingEmail={emailChange.pendingEmail}
                                    onDifferentEmail={() => setMode('email')}
                                    onCancel={() => setMode('view')}
                                />
                            ) : (
                                <AccountStateCard
                                    icon={CheckIcon}
                                    tone="success"
                                    title="Your email is verified"
                                    action={
                                        <Button
                                            className="h-11"
                                            onClick={() => setMode('view')}
                                        >
                                            <ArrowRightIcon aria-hidden="true" />
                                            Return to profile
                                        </Button>
                                    }
                                >
                                    Your Rinquo account now uses{' '}
                                    <strong className="font-semibold text-foreground">
                                        {emailChange.changedTo ?? profile.email}
                                    </strong>
                                    . We also attempted to notify your previous
                                    email address.
                                </AccountStateCard>
                            )}
                            <AccountInfoPanel
                                icon={GlobeIcon}
                                title="One account, multiple shops"
                                className="lg:min-h-full"
                            >
                                {SHARED_NOTE}
                            </AccountInfoPanel>
                        </>
                    )}
                </div>
            </div>
        </CustomerShell>
    );
}

function Panel({ children }: { children: ReactNode }) {
    return (
        <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
            {children}
        </section>
    );
}

function PanelHeading({
    eyebrow,
    title,
    children,
    focusOnMount = true,
}: {
    eyebrow?: string;
    title: string;
    children: ReactNode;
    /** Move focus to the heading when the panel opens; off where a field takes focus instead. */
    focusOnMount?: boolean;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (focusOnMount) {
            heading.current?.focus();
        }
    }, [focusOnMount]);

    return (
        <div className="grid gap-1">
            {eyebrow ? (
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                    {eyebrow}
                </p>
            ) : null}
            <h2
                ref={heading}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight outline-none"
            >
                {title}
            </h2>
            <p className="max-w-[66ch] text-sm text-muted-foreground">
                {children}
            </p>
        </div>
    );
}

function ProfileSummary({
    profile,
    pendingEmail,
    onEdit,
    onContinueEmail,
}: {
    profile: CustomerProfileProps['profile'];
    pendingEmail: string | null;
    onEdit: () => void;
    onContinueEmail: () => void;
}) {
    const rows: [typeof UserRoundIcon, string, string][] = [
        [UserRoundIcon, 'Name', profile.name || 'Not provided'],
        [MailIcon, 'Email', profile.email],
        [PhoneIcon, 'Phone', profile.phone || 'Not provided'],
    ];

    return (
        <Panel>
            <div className="flex min-w-0 items-start gap-4">
                <span
                    aria-hidden="true"
                    className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary"
                >
                    {initials(profile.name, profile.email)}
                </span>
                <div className="grid min-w-0 gap-1">
                    <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">
                        {profile.name || 'Your Rinquo account'}
                    </h2>
                    <p className="text-sm break-all text-muted-foreground">
                        {profile.email}
                    </p>
                    {profile.emailVerified ? (
                        <StatusChip tone="success" className="w-fit">
                            Verified email
                        </StatusChip>
                    ) : null}
                </div>
            </div>
            <dl className="mt-5 divide-y border-y">
                {rows.map(([Icon, label, value]) => (
                    <div
                        key={label}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4"
                    >
                        <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon aria-hidden="true" className="size-4" />
                            {label}
                        </dt>
                        <dd className="min-w-0 text-sm font-semibold break-all">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
            {pendingEmail ? (
                <Alert className={`mt-5 ${ALERT_TONES.info}`}>
                    <InfoIcon aria-hidden="true" />
                    <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        A code was sent to {pendingEmail}. Your current email
                        stays active until it is verified.
                        <Button
                            variant="link"
                            className="h-auto min-h-11 p-0"
                            onClick={onContinueEmail}
                        >
                            Enter the code
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            <Button className="mt-5 h-11" onClick={onEdit}>
                <PencilIcon aria-hidden="true" />
                Edit profile
            </Button>
        </Panel>
    );
}

function AccountSecurity({ onChangeEmail }: { onChangeEmail: () => void }) {
    return (
        <Panel>
            <h2 className="text-xl font-semibold tracking-tight">
                Account security
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Your email identifies your Rinquo account across participating
                shops.
            </p>
            <div className="mt-5 flex items-start gap-3">
                <ShieldCheckIcon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-primary"
                />
                <div className="grid gap-0.5">
                    <p className="text-sm font-semibold">Email address</p>
                    <p className="text-xs text-muted-foreground">
                        Verified and protected using an email code
                    </p>
                </div>
            </div>
            <Button
                variant="outline"
                className="mt-4 h-11 text-primary"
                onClick={onChangeEmail}
            >
                <MailIcon aria-hidden="true" />
                Change email
                <ChevronRightIcon aria-hidden="true" className="sm:hidden" />
            </Button>
        </Panel>
    );
}

function NetworkAlert({ show }: { show: boolean }) {
    return show ? (
        <Alert className={ALERT_TONES.error} role="alert">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{OFFLINE}</AlertDescription>
        </Alert>
    ) : null;
}

function EditProfile({
    profile,
    onDone,
}: {
    profile: CustomerProfileProps['profile'];
    onDone: () => void;
}) {
    const form = useForm({ name: profile.name, phone: profile.phone });
    const [offline, setOffline] = useState(false);
    const formElement = useRef<HTMLFormElement>(null);

    useFocusFirstInvalid(formElement, form.errors);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        setOffline(false);
        form.patch('/account/profile', {
            preserveScroll: true,
            onSuccess: onDone,
            onNetworkError: () => {
                setOffline(true);

                return false;
            },
        });
    }

    return (
        <Panel>
            <PanelHeading title="Edit profile">
                These details are part of your platform customer profile.
            </PanelHeading>
            <form
                ref={formElement}
                onSubmit={submit}
                className="mt-6 grid gap-4"
                noValidate
            >
                <TextField
                    label="Name"
                    autoComplete="name"
                    maxLength={120}
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    error={form.errors.name}
                    controlClassName="h-11 border-booking-control"
                />
                <TextField
                    label="Phone number (optional)"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={form.data.phone}
                    onChange={(event) =>
                        form.setData('phone', event.target.value)
                    }
                    error={form.errors.phone}
                    controlClassName="h-11 border-booking-control"
                />
                <NetworkAlert show={offline} />
                <div className="flex flex-wrap gap-3">
                    <Button
                        type="submit"
                        className="h-11"
                        disabled={form.processing}
                        aria-busy={form.processing}
                    >
                        {form.processing ? (
                            <Spinner role="presentation" aria-hidden="true" />
                        ) : (
                            <CheckIcon aria-hidden="true" />
                        )}
                        {form.processing ? 'Saving changes...' : 'Save changes'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        disabled={form.processing}
                        onClick={onDone}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function RequestEmailChange({
    currentEmail,
    initialEmail,
    onCancel,
    onSent,
}: {
    currentEmail: string;
    initialEmail: string;
    onCancel: () => void;
    onSent: () => void;
}) {
    const form = useForm({ email: initialEmail });
    const [offline, setOffline] = useState(false);
    const formElement = useRef<HTMLFormElement>(null);

    useFocusFirstInvalid(formElement, form.errors);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        setOffline(false);
        form.post('/account/profile/email-change', {
            preserveScroll: true,
            onSuccess: onSent,
            onNetworkError: () => {
                setOffline(true);

                return false;
            },
        });
    }

    return (
        <Panel>
            <PanelHeading
                eyebrow="Email security"
                title="Change your email address"
            >
                We will send a code to the new email address. Your current email
                remains active until the code is verified.
            </PanelHeading>
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3 text-sm">
                <InfoIcon aria-hidden="true" className="size-4 text-primary" />
                <span>
                    Current email:{' '}
                    <strong className="font-semibold break-all">
                        {currentEmail}
                    </strong>
                </span>
            </p>
            <form
                ref={formElement}
                onSubmit={submit}
                className="mt-5 grid gap-4"
                noValidate
            >
                <TextField
                    label="New email address"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={255}
                    value={form.data.email}
                    onChange={(event) =>
                        form.setData('email', event.target.value)
                    }
                    error={form.errors.email}
                    controlClassName="h-11 border-booking-control"
                />
                <NetworkAlert show={offline} />
                <Button
                    type="submit"
                    className="h-12"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : (
                        <MailIcon aria-hidden="true" />
                    )}
                    {form.processing
                        ? 'Sending code...'
                        : 'Send verification code'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={form.processing}
                    onClick={onCancel}
                >
                    Cancel
                </Button>
            </form>
        </Panel>
    );
}

function VerifyEmailChange({
    pendingEmail,
    onDifferentEmail,
    onCancel,
}: {
    pendingEmail: string;
    onDifferentEmail: () => void;
    onCancel: () => void;
}) {
    const verify = useForm({ code: '' });
    const resend = useForm({ email: pendingEmail });
    const [offline, setOffline] = useState(false);
    const [resent, setResent] = useState(false);
    const failed = Boolean(verify.errors.code);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (verify.processing) {
            return;
        }
        setOffline(false);
        setResent(false);
        verify.post('/account/profile/email-change/verify', {
            preserveScroll: true,
            onError: () => verify.reset('code'),
            onNetworkError: () => {
                setOffline(true);

                return false;
            },
        });
    }

    function sendNewCode() {
        if (resend.processing) {
            return;
        }
        setOffline(false);
        setResent(false);
        resend.post('/account/profile/email-change', {
            preserveScroll: true,
            onSuccess: () => {
                verify.reset('code');
                verify.clearErrors();
                setResent(true);
            },
            onNetworkError: () => {
                setOffline(true);

                return false;
            },
        });
    }

    return (
        <Panel>
            {failed ? (
                <div className="flex items-start gap-3">
                    <CircleAlertIcon
                        aria-hidden="true"
                        className="mt-1 size-5 shrink-0 text-destructive"
                    />
                    <PanelHeading
                        title="That code could not be verified"
                        focusOnMount={false}
                    >
                        The code was invalid or expired. No email address was
                        changed.
                    </PanelHeading>
                </div>
            ) : (
                <PanelHeading
                    eyebrow="Email security · Step 2"
                    title="Verify your new email"
                    focusOnMount={false}
                >
                    A six-digit code was sent to your new email address. Your
                    old address stays active until this verification succeeds.
                </PanelHeading>
            )}
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3 text-sm">
                <MailIcon aria-hidden="true" className="size-4 text-primary" />
                <span>
                    Code sent to{' '}
                    <strong className="font-semibold break-all">
                        {pendingEmail}
                    </strong>
                </span>
            </p>
            {resent ? (
                <p role="status" className="mt-3 text-sm text-success-text">
                    A new code was sent to {pendingEmail}. Earlier codes no
                    longer work.
                </p>
            ) : null}
            <form onSubmit={submit} className="mt-5 grid gap-4" noValidate>
                <OtpInput
                    value={verify.data.code}
                    onChange={(code) => verify.setData('code', code)}
                    label="Six-digit code from your new email"
                    error={verify.errors.code}
                    disabled={verify.processing}
                    autoFocus
                />
                <NetworkAlert show={offline} />
                <Button
                    type="submit"
                    className="h-12"
                    disabled={
                        verify.processing || verify.data.code.length !== 6
                    }
                    aria-busy={verify.processing}
                >
                    {verify.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : (
                        <CheckIcon aria-hidden="true" />
                    )}
                    {verify.processing
                        ? 'Verifying...'
                        : failed
                          ? 'Try code again'
                          : 'Verify new email'}
                </Button>
            </form>
            <div className="mt-5 grid gap-3 border-t pt-5 text-sm">
                {resend.errors.email ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            {resend.errors.email}
                        </AlertDescription>
                    </Alert>
                ) : null}
                <p className="text-muted-foreground">
                    Code expired or used up? Request a fresh one; it replaces
                    the earlier code.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={sendNewCode}
                        disabled={resend.processing || verify.processing}
                        aria-busy={resend.processing}
                    >
                        {resend.processing ? (
                            <Spinner role="presentation" aria-hidden="true" />
                        ) : null}
                        {resend.processing
                            ? 'Sending new code...'
                            : 'Send a new code'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={onDifferentEmail}
                        disabled={resend.processing || verify.processing}
                    >
                        Use a different email
                    </Button>
                    <Button
                        type="button"
                        variant="link"
                        className="h-11"
                        onClick={onCancel}
                    >
                        Back to profile
                    </Button>
                </div>
            </div>
        </Panel>
    );
}
