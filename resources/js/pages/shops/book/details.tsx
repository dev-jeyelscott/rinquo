import { Head, router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { BookingSummaryCard } from '@/components/booking/booking-summary-card';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import {
    BOOKING_STEPS,
    StepIndicator,
} from '@/components/booking/step-indicator';
import {
    SelectField,
    TextareaField,
    TextField,
} from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { ALERT_TONES } from '@/lib/tones';
import type { DetailsPageProps } from '@/types/booking';

/**
 * Step 4: contact details, then (signed out) email verification with a
 * one-time code. A signed-in customer skips the code and keeps their verified
 * email. The held time keeps counting down above the form; when it runs out the
 * same primary action tries to keep the time and the server re-validates it.
 */
export default function Details({
    branch,
    hold,
    summary,
    signedIn,
    contact,
    savedVehicles,
    verification,
    urls,
}: DetailsPageProps) {
    const inCodeStep = verification.step === 'code' && !signedIn;
    const remaining = useCountdown(hold.expiresInSeconds);
    const expired = hold.expired || remaining <= 0;

    return (
        <>
            <Head title="Your details" />
            <div className="grid gap-6">
                <div className="grid gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Your details
                    </h1>
                    <StepIndicator steps={BOOKING_STEPS} current="details" />
                    <HoldCountdown
                        remaining={remaining}
                        expired={expired}
                        chooseAnotherUrl={urls.wizard}
                    />
                </div>
                <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
                    <section className="grid gap-5">
                        {inCodeStep ? (
                            <CodeStep
                                contact={contact}
                                email={verification.email ?? ''}
                                resendInSeconds={verification.resendInSeconds}
                                urls={urls}
                            />
                        ) : (
                            <DetailsForm
                                contact={contact}
                                savedVehicles={savedVehicles}
                                signedIn={signedIn}
                                expired={expired}
                                urls={urls}
                            />
                        )}
                    </section>
                    <aside
                        aria-label="Booking summary"
                        className="lg:sticky lg:top-6"
                    >
                        <BookingSummaryCard
                            vehicleName={summary.vehicleName}
                            serviceName={summary.serviceName}
                            addOns={summary.addOns}
                            totalCentavos={summary.totalCentavos}
                            durationMinutes={summary.durationMinutes}
                            bufferMinutes={summary.bufferMinutes}
                            startAt={summary.startAt}
                            timezone={branch.timezone}
                        />
                    </aside>
                </div>
            </div>
        </>
    );
}

function DetailsForm({
    contact,
    savedVehicles,
    signedIn,
    expired,
    urls,
}: {
    contact: DetailsPageProps['contact'];
    savedVehicles: DetailsPageProps['savedVehicles'];
    signedIn: boolean;
    expired: boolean;
    urls: DetailsPageProps['urls'];
}) {
    const form = useForm({
        contact_name: contact.name,
        contact_phone: contact.phone,
        vehicle_plate: contact.plate,
        customer_vehicle_id: null as number | null,
        customer_notes: contact.notes,
        email: '',
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) =>
            signedIn
                ? {
                      contact_name: data.contact_name,
                      contact_phone: data.contact_phone,
                      vehicle_plate: data.vehicle_plate,
                      customer_vehicle_id: data.customer_vehicle_id,
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
        <form
            onSubmit={submit}
            aria-labelledby="details-heading"
            noValidate
            className="grid gap-4"
        >
            <h2
                id="details-heading"
                className="text-2xl font-semibold tracking-tight"
            >
                Who is this booking for?
            </h2>
            <TextField
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
                label="Phone (optional)"
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
            {signedIn && savedVehicles.length > 0 ? (
                <SelectField
                    label="Saved vehicle (optional)"
                    name="customer_vehicle_id"
                    value={form.data.customer_vehicle_id ?? ''}
                    onChange={(event) =>
                        form.setData(
                            'customer_vehicle_id',
                            event.target.value === ''
                                ? null
                                : Number(event.target.value),
                        )
                    }
                    options={savedVehicles.map((vehicle) => ({
                        value: String(vehicle.id),
                        label: vehicle.label
                            ? `${vehicle.plate} — ${vehicle.label}`
                            : vehicle.plate,
                    }))}
                    placeholder="Enter a plate manually instead"
                    hint="Selecting one uses its saved plate for this booking."
                    error={form.errors.customer_vehicle_id}
                />
            ) : null}
            <TextField
                label="Plate number or vehicle note (optional)"
                name="vehicle_plate"
                maxLength={20}
                value={form.data.vehicle_plate}
                onChange={(event) =>
                    form.setData('vehicle_plate', event.target.value)
                }
                error={form.errors.vehicle_plate}
            />
            <TextareaField
                label="Notes for the shop (optional)"
                name="customer_notes"
                maxLength={500}
                value={form.data.customer_notes}
                onChange={(event) =>
                    form.setData('customer_notes', event.target.value)
                }
                error={form.errors.customer_notes}
            />
            <div>
                <Button
                    type="submit"
                    className="max-sm:h-11"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {form.processing ? 'Saving…' : label}
                </Button>
            </div>
        </form>
    );
}

function CodeStep({
    contact,
    email,
    resendInSeconds,
    urls,
}: {
    contact: DetailsPageProps['contact'];
    email: string;
    resendInSeconds: number;
    urls: DetailsPageProps['urls'];
}) {
    const verify = useForm({ code: '' });
    const resend = useForm({});
    const resendError = (resend.errors as Record<string, string | undefined>)
        .email;
    const remaining = useCountdown(resendInSeconds);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        verify.post(urls.verify, { onError: () => verify.reset('code') });
    }

    return (
        <div className="grid gap-5">
            <div className="grid gap-1 rounded-2xl border bg-card p-4 text-sm">
                <p className="font-semibold">{contact.name}</p>
                <p className="text-muted-foreground">{email}</p>
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="w-fit px-0"
                    onClick={() => router.post(urls.restart)}
                >
                    Edit details or use a different email
                </Button>
            </div>
            <form
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
                        Enter the 6-digit code we sent to {email}. Your time
                        stays held while you do.
                    </p>
                </div>
                <TextField
                    label="Verification code"
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
                <div>
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
                        {verify.processing
                            ? 'Verifying…'
                            : 'Verify and continue'}
                    </Button>
                </div>
            </form>
            {resendError ? (
                <Alert className={ALERT_TONES.error}>
                    <AlertDescription>
                        <p>{resendError}</p>
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    disabled={remaining > 0 || resend.processing}
                    onClick={() =>
                        resend.post(urls.code, { preserveScroll: true })
                    }
                >
                    Resend code
                </Button>
                <span
                    role="status"
                    className="text-muted-foreground tabular-nums"
                >
                    {remaining > 0
                        ? `You can request another code in ${remaining} seconds.`
                        : 'You can request another code now.'}
                </span>
            </div>
        </div>
    );
}
