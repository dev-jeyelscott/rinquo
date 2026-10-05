import { Head, Link, useForm } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { BookingSummaryCard } from '@/components/booking/booking-summary-card';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import {
    BOOKING_STEPS,
    StepIndicator,
} from '@/components/booking/step-indicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { ConfirmPageProps } from '@/types/booking';

/**
 * Step 5: a deliberate review of everything being confirmed, on its own page
 * (not a modal: the summary is the context). The button posts once and is
 * disabled while it runs; the server never reports success before the booking
 * exists, and a retry after a network failure is safe because confirmation is
 * idempotent per hold.
 */
export default function Confirm({
    branch,
    hold,
    summary,
    contact,
    customerEmail,
    urls,
}: ConfirmPageProps) {
    const form = useForm({});
    const remaining = useCountdown(hold.expiresInSeconds);
    const expired = hold.expired || remaining <= 0;
    const [networkFailed, setNetworkFailed] = useState(false);
    const lostTime = (form.errors as Record<string, string | undefined>)
        .start_at;

    function confirm() {
        setNetworkFailed(false);
        form.post(urls.confirm, {
            onNetworkError: () => setNetworkFailed(true),
            onHttpException: () => {
                setNetworkFailed(true);

                return false;
            },
        });
    }

    return (
        <>
            <Head title="Confirm your booking" />
            <div className="grid gap-6">
                <div className="grid gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Review and confirm
                    </h1>
                    <StepIndicator steps={BOOKING_STEPS} current="confirm" />
                    <HoldCountdown
                        remaining={remaining}
                        expired={expired}
                        chooseAnotherUrl={urls.wizard}
                    />
                </div>
                <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
                    <section
                        aria-labelledby="contact-heading"
                        className="grid gap-5"
                    >
                        <div className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
                            <h2
                                id="contact-heading"
                                className="text-lg font-semibold"
                            >
                                Your details
                            </h2>
                            <dl className="grid gap-2">
                                <Row label="Name" value={contact.name} />
                                <Row
                                    label="Email (verified)"
                                    value={customerEmail}
                                />
                                {contact.phone ? (
                                    <Row label="Phone" value={contact.phone} />
                                ) : null}
                                {contact.plate ? (
                                    <Row
                                        label="Plate or vehicle note"
                                        value={contact.plate}
                                    />
                                ) : null}
                                {contact.notes ? (
                                    <Row label="Notes" value={contact.notes} />
                                ) : null}
                            </dl>
                            <Link
                                href={urls.details}
                                className="w-fit text-primary underline underline-offset-4"
                            >
                                Edit details
                            </Link>
                        </div>

                        {lostTime ? (
                            <Alert className={ALERT_TONES.error}>
                                <CircleAlertIcon aria-hidden="true" />
                                <AlertTitle>
                                    That time is no longer available
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        Nothing was booked. Your vehicle,
                                        service and add-ons are kept, so you can
                                        pick another time.
                                    </p>
                                    <Link
                                        href={urls.wizard}
                                        className={cn(
                                            buttonVariants({
                                                variant: 'outline',
                                            }),
                                            'max-sm:h-11',
                                        )}
                                    >
                                        Choose another time
                                    </Link>
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {networkFailed ? (
                            <Alert className={ALERT_TONES.warning}>
                                <CircleAlertIcon aria-hidden="true" />
                                <AlertTitle>
                                    We couldn&apos;t confirm whether your
                                    booking was created
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        Try again. Confirming twice never
                                        creates two bookings.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                className="max-sm:h-11"
                                disabled={form.processing}
                                aria-busy={form.processing}
                                onClick={confirm}
                            >
                                {form.processing ? (
                                    <Spinner
                                        role="presentation"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {form.processing
                                    ? 'Confirming…'
                                    : networkFailed
                                      ? 'Try again'
                                      : expired
                                        ? 'Try to keep this time'
                                        : 'Confirm booking'}
                            </Button>
                        </div>
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

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold break-words">{value}</dd>
        </div>
    );
}
