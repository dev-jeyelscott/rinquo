import { Head, router, useForm } from '@inertiajs/react';
import { ArrowRightIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { BookingJourneyHeader } from '@/components/booking/booking-journey-header';
import {
    BookingSummaryCard,
    BookingSummaryCompact,
} from '@/components/booking/booking-summary-card';
import {
    HoldCountdown,
    HoldCountdownStatus,
} from '@/components/booking/hold-countdown';
import { OtpInput } from '@/components/booking/otp-input';
import { TextareaField, TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { formatClock } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import type { DetailsPageProps } from '@/types/booking';

/**
 * Step 4: contact details and vehicle make and model, then (signed out) email
 * verification with a one-time code as a substate of the same step. A
 * signed-in customer skips the code and keeps their verified email. The held
 * time keeps counting down above the form; when it runs out the same primary
 * action tries to keep the time and the server re-validates it.
 */
export default function Details({
    shop,
    branch,
    hold,
    summary,
    signedIn,
    contact,
    verification,
    urls,
}: DetailsPageProps) {
    const inCodeStep = verification.step === 'code' && !signedIn;
    const remaining = useCountdown(hold.expiresInSeconds);
    const expired = hold.expired || remaining <= 0;
    const summaryInput = {
        vehicleName: summary.vehicleName,
        vehicleMakeModel: summary.vehicleMakeModel,
        serviceName: summary.serviceName,
        addOns: summary.addOns,
        totalCentavos: summary.totalCentavos,
        durationMinutes: summary.durationMinutes,
        startAt: summary.startAt,
        timezone: branch.timezone,
    };

    return (
        <>
            <Head title={inCodeStep ? 'Verify your email' : 'Your details'} />
            <div className="grid gap-6 pb-36 lg:pb-0">
                <BookingJourneyHeader
                    shopName={shop.name}
                    shopUrl={urls.shop}
                    title={
                        inCodeStep ? 'Email verification' : 'Customer details'
                    }
                    step="details"
                />
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                    <section className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-7">
                        <BookingSummaryCompact {...summaryInput} />
                        <HoldCountdown
                            remaining={remaining}
                            expired={expired}
                            chooseAnotherUrl={urls.wizard}
                        />
                        {inCodeStep ? (
                            <CodeStep
                                contact={contact}
                                email={verification.email ?? ''}
                                codeLength={verification.codeLength}
                                resendInSeconds={verification.resendInSeconds}
                                remaining={remaining}
                                urls={urls}
                            />
                        ) : (
                            <DetailsForm
                                contact={contact}
                                signedIn={signedIn}
                                expired={expired}
                                remaining={remaining}
                                urls={urls}
                            />
                        )}
                    </section>
                    <aside
                        aria-label="Booking summary"
                        className="lg:sticky lg:top-6"
                    >
                        <BookingSummaryCard {...summaryInput} />
                    </aside>
                </div>
            </div>
        </>
    );
}

function DetailsForm({
    contact,
    signedIn,
    expired,
    remaining,
    urls,
}: {
    contact: DetailsPageProps['contact'];
    signedIn: boolean;
    expired: boolean;
    remaining: number;
    urls: DetailsPageProps['urls'];
}) {
    const heading = useFocusOnChange<HTMLHeadingElement>('details', {
        onMount: true,
    });
    const formElement = useRef<HTMLFormElement>(null);
    const form = useForm({
        contact_name: contact.name,
        contact_phone: contact.phone,
        vehicle_make_model: contact.makeModel,
        vehicle_plate: contact.plate,
        customer_notes: contact.notes,
        email: '',
    });

    // A failed submit lands on the first invalid field, whose error is its description.
    useEffect(() => {
        if (Object.keys(form.errors).length > 0) {
            formElement.current
                ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus();
        }
    }, [form.errors]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        form.transform((data) =>
            signedIn
                ? {
                      contact_name: data.contact_name,
                      contact_phone: data.contact_phone,
                      vehicle_make_model: data.vehicle_make_model,
                      vehicle_plate: data.vehicle_plate,
                      customer_notes: data.customer_notes,
                  }
                : data,
        );
        form.put(urls.details, { preserveScroll: true });
    }

    const label = expired
        ? 'Try to keep this time'
        : signedIn
          ? 'Continue'
          : 'Email me a code';

    return (
        <>
            <form
                id="details-form"
                ref={formElement}
                onSubmit={submit}
                aria-labelledby="details-heading"
                noValidate
                className="grid gap-4"
            >
                <div className="grid gap-1">
                    <h2
                        id="details-heading"
                        ref={heading}
                        tabIndex={-1}
                        className="text-2xl font-semibold tracking-tight outline-none"
                    >
                        Who is this booking for?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {signedIn
                            ? 'You are signed in, so your verified email is used.'
                            : 'No account needed. We will verify your email before you confirm.'}
                    </p>
                </div>
                <TextField
                    controlClassName="border-booking-control"
                    label="Full name"
                    name="contact_name"
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={form.data.contact_name}
                    onChange={(event) =>
                        form.setData('contact_name', event.target.value)
                    }
                    error={form.errors.contact_name}
                />
                {signedIn ? null : (
                    <TextField
                        controlClassName="border-booking-control"
                        label="Email address"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        hint="We email a 6-digit code to confirm it is yours."
                        value={form.data.email}
                        onChange={(event) =>
                            form.setData('email', event.target.value)
                        }
                        error={form.errors.email}
                    />
                )}
                <TextField
                    controlClassName="border-booking-control"
                    label="Mobile number (optional)"
                    name="contact_phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={form.data.contact_phone}
                    onChange={(event) =>
                        form.setData('contact_phone', event.target.value)
                    }
                    error={form.errors.contact_phone}
                />
                <TextField
                    controlClassName="border-booking-control"
                    label="Vehicle make / model"
                    name="vehicle_make_model"
                    autoComplete="off"
                    required
                    maxLength={120}
                    value={form.data.vehicle_make_model}
                    onChange={(event) =>
                        form.setData('vehicle_make_model', event.target.value)
                    }
                    error={form.errors.vehicle_make_model}
                />
                <TextField
                    controlClassName="border-booking-control"
                    label="Plate number (optional)"
                    name="vehicle_plate"
                    maxLength={20}
                    value={form.data.vehicle_plate}
                    onChange={(event) =>
                        form.setData('vehicle_plate', event.target.value)
                    }
                    error={form.errors.vehicle_plate}
                />
                <TextareaField
                    controlClassName="border-booking-control"
                    label="Notes for the shop (optional)"
                    name="customer_notes"
                    maxLength={500}
                    value={form.data.customer_notes}
                    onChange={(event) =>
                        form.setData('customer_notes', event.target.value)
                    }
                    error={form.errors.customer_notes}
                />
            </form>
            <BookingActionBar
                back={{ href: urls.wizard }}
                meta={<HoldCountdownStatus remaining={remaining} />}
            >
                <Button
                    type="submit"
                    form="details-form"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {form.processing ? 'Saving…' : label}
                    {form.processing ? null : (
                        <ArrowRightIcon aria-hidden="true" />
                    )}
                </Button>
            </BookingActionBar>
        </>
    );
}

function CodeStep({
    contact,
    email,
    codeLength,
    resendInSeconds,
    remaining: heldRemaining,
    urls,
}: {
    contact: DetailsPageProps['contact'];
    email: string;
    codeLength: number;
    resendInSeconds: number;
    remaining: number;
    urls: DetailsPageProps['urls'];
}) {
    const verify = useForm({ code: '' });
    const resend = useForm({});
    const resendError = (resend.errors as Record<string, string | undefined>)
        .email;
    const remaining = useCountdown(resendInSeconds);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (verify.processing || verify.data.code.length !== codeLength) {
            return;
        }
        verify.post(urls.verify, { onError: () => verify.reset('code') });
    }

    return (
        <>
            <form
                id="code-form"
                onSubmit={submit}
                aria-labelledby="code-heading"
                noValidate
                className="grid gap-4"
            >
                <div className="grid gap-1">
                    <h2
                        id="code-heading"
                        className="text-2xl font-semibold tracking-tight"
                    >
                        Verify your email
                    </h2>
                    <p className="max-w-[66ch] text-sm text-muted-foreground">
                        Enter the {codeLength}-digit code we sent to your email.
                        This helps protect your booking.
                    </p>
                </div>
                <div className="grid gap-1 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p>
                        <span className="text-muted-foreground">
                            Verification email{' '}
                        </span>
                        <span className="font-semibold break-all">{email}</span>
                    </p>
                    <p className="text-muted-foreground">{contact.name}</p>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto min-h-8 w-fit justify-start px-0 font-semibold"
                        onClick={() => router.post(urls.restart)}
                    >
                        Edit details or use a different email
                        <ArrowRightIcon aria-hidden="true" />
                    </Button>
                </div>
                <OtpInput
                    length={codeLength}
                    label={`${codeLength}-digit verification code`}
                    value={verify.data.code}
                    onChange={(code) => {
                        verify.setData('code', code);
                        if (verify.errors.code) {
                            verify.clearErrors('code');
                        }
                    }}
                    error={verify.errors.code}
                    autoFocus
                    disabled={verify.processing}
                />
            </form>
            {resendError ? (
                <Alert className={ALERT_TONES.error}>
                    <AlertDescription>
                        <p>{resendError}</p>
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p role="status" className="text-muted-foreground tabular-nums">
                    {remaining > 0 ? (
                        <>
                            Resend code in{' '}
                            <span className="font-semibold text-foreground">
                                {formatClock(remaining, true)}
                            </span>
                        </>
                    ) : (
                        'You can request another code now.'
                    )}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    className="max-lg:h-11"
                    disabled={remaining > 0 || resend.processing}
                    onClick={() =>
                        resend.post(urls.code, { preserveScroll: true })
                    }
                >
                    Resend code
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                Your time remains temporarily held during verification.
            </p>
            <BookingActionBar
                back={{ onClick: () => router.post(urls.restart) }}
                meta={<HoldCountdownStatus remaining={heldRemaining} />}
            >
                <Button
                    type="submit"
                    form="code-form"
                    disabled={
                        verify.processing ||
                        verify.data.code.length !== codeLength
                    }
                    aria-busy={verify.processing}
                >
                    {verify.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {verify.processing ? 'Verifying…' : 'Verify and continue'}
                    {verify.processing ? null : (
                        <ArrowRightIcon aria-hidden="true" />
                    )}
                </Button>
            </BookingActionBar>
        </>
    );
}
