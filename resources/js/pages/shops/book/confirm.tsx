import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRightIcon, CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { BookingJourneyHeader } from '@/components/booking/booking-journey-header';
import {
    BookingSummaryCard,
    BookingSummaryCompact,
    DetailRows,
    vehicleLabel,
} from '@/components/booking/booking-summary-card';
import type { DetailRow } from '@/components/booking/booking-summary-card';
import {
    HoldCountdown,
    HoldCountdownStatus,
} from '@/components/booking/hold-countdown';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { ConfirmPageProps } from '@/types/booking';

/**
 * Step 5: a deliberate review of everything being confirmed, on its own page
 * (not a modal: the summary is the context). The button posts once and is
 * disabled while it runs; the server never reports success before the booking
 * exists, and a retry after a network failure is safe because confirmation is
 * idempotent per hold. When the shop approves each booking first the action
 * says it sends a request, never that it confirms one.
 */
export default function Confirm({
    shop,
    branch,
    hold,
    summary,
    contact,
    customerEmail,
    requestOnly,
    urls,
}: ConfirmPageProps) {
    const form = useForm({});
    const remaining = useCountdown(hold.expiresInSeconds);
    const heading = useFocusOnChange<HTMLHeadingElement>('review', {
        onMount: true,
    });
    const expired = hold.expired || remaining <= 0;
    const [networkFailed, setNetworkFailed] = useState(false);
    const lostTime = (form.errors as Record<string, string | undefined>)
        .start_at;
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

    function confirm() {
        if (form.processing) {
            return;
        }
        setNetworkFailed(false);
        form.post(urls.confirm, {
            onNetworkError: () => setNetworkFailed(true),
            onHttpException: () => {
                setNetworkFailed(true);

                return false;
            },
        });
    }

    const bookingRows: DetailRow[] = [
        ['Vehicle', vehicleLabel(summary.vehicleName, contact.makeModel)],
        ['Service', summary.serviceName],
        ...(summary.addOns.length > 0
            ? [
                  [
                      summary.addOns.length === 1 ? 'Add-on' : 'Add-ons',
                      summary.addOns.map((addOn) => addOn.name).join(', '),
                  ] as DetailRow,
              ]
            : []),
        ['Duration', formatMinutes(summary.durationMinutes)],
        ['Exact start', formatDayAndTime(summary.startAt, branch.timezone)],
        ['Service price', formatCentavos(summary.totalCentavos)],
    ];
    const contactRows: DetailRow[] = [
        ['Name', contact.name],
        ['Email (verified)', customerEmail],
        ...(contact.phone ? [['Phone', contact.phone] as DetailRow] : []),
        ...(contact.plate
            ? [['Plate number', contact.plate] as DetailRow]
            : []),
        ...(contact.notes ? [['Notes', contact.notes] as DetailRow] : []),
    ];

    const label = form.processing
        ? requestOnly
            ? 'Sending request…'
            : 'Confirming…'
        : networkFailed
          ? 'Try again'
          : expired
            ? 'Try to keep this time'
            : requestOnly
              ? 'Send booking request'
              : 'Confirm booking';

    return (
        <>
            <Head title="Confirm your booking" />
            <div className="grid gap-6 pb-36 lg:pb-0">
                <BookingJourneyHeader
                    shopName={shop.name}
                    shopUrl={urls.shop}
                    title="Review and confirm"
                    step="confirm"
                />
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                    <section
                        aria-labelledby="review-heading"
                        className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-7"
                    >
                        <BookingSummaryCompact {...summaryInput} />
                        <HoldCountdown
                            remaining={remaining}
                            expired={expired}
                            chooseAnotherUrl={urls.wizard}
                        />
                        <div className="grid gap-1">
                            <h2
                                id="review-heading"
                                ref={heading}
                                tabIndex={-1}
                                className="text-2xl font-semibold tracking-tight outline-none"
                            >
                                Review before confirming
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {requestOnly
                                    ? 'Check the details. The shop reviews your request before it is confirmed. You are not being charged online.'
                                    : 'Check the details. You are not being charged online.'}
                            </p>
                        </div>

                        <ReviewGroup
                            heading="Booking details"
                            editHref={urls.wizard}
                            editLabel="Edit booking"
                            rows={bookingRows}
                        />
                        <ReviewGroup
                            heading="Your contact"
                            editHref={urls.details}
                            editLabel="Edit details"
                            rows={contactRows}
                        />

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
                                            'max-lg:min-h-11',
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

                        <BookingActionBar
                            back={{ href: urls.details }}
                            meta={<HoldCountdownStatus remaining={remaining} />}
                        >
                            <Button
                                type="button"
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
                                {label}
                                {form.processing ? null : (
                                    <ArrowRightIcon aria-hidden="true" />
                                )}
                            </Button>
                        </BookingActionBar>
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

function ReviewGroup({
    heading,
    editHref,
    editLabel,
    rows,
}: {
    heading: string;
    editHref: string;
    editLabel: string;
    rows: DetailRow[];
}) {
    return (
        <section
            aria-label={heading}
            className="grid gap-3 rounded-xl border p-4"
        >
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{heading}</h3>
                <Link
                    href={editHref}
                    className="inline-flex min-h-8 items-center text-sm font-semibold text-primary underline underline-offset-4"
                >
                    {editLabel}
                </Link>
            </div>
            <DetailRows rows={rows} />
        </section>
    );
}
