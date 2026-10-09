import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    CircleCheckIcon,
    ClockIcon,
    CircleXIcon,
    ArrowRightIcon,
    RefreshCwIcon,
} from 'lucide-react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { BookingJourneyHeader } from '@/components/booking/booking-journey-header';
import { BookingLiveStatus } from '@/components/booking/booking-live-status';
import {
    DetailRows,
    vehicleLabel,
} from '@/components/booking/booking-summary-card';
import type { DetailRow } from '@/components/booking/booking-summary-card';
import { RescheduleProposalCard } from '@/components/booking/reschedule-proposal-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useBookingLive } from '@/hooks/use-booking-live';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { formatLongDayAndTime, wallTimeToInstant } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { BookingPageProps, BookingStatus } from '@/types/booking';

const OUTCOMES: Record<
    BookingStatus,
    { title: string; tone: 'success' | 'warning' | 'error' }
> = {
    confirmed: { title: 'Booking confirmed', tone: 'success' },
    pending_approval: { title: 'Request sent', tone: 'warning' },
    declined: { title: 'Request declined', tone: 'error' },
    expired: { title: 'Request expired', tone: 'error' },
    cancelled: { title: 'Booking cancelled', tone: 'error' },
    rescheduled: { title: 'Booking rescheduled', tone: 'warning' },
};

/** The status disc above the outcome title: a tinted token surface, an icon and the title carry the meaning. */
const DISC: Record<'success' | 'warning' | 'error', string> = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-destructive/10 text-destructive',
};

/** Form controls on this page need a boundary of at least 3:1 (WCAG 1.4.11); the field token is near-white. */
const FIELD_BORDER = 'border border-muted-foreground bg-background';

/**
 * The durable result of a booking, at its own URL (Spec 02 outcome
 * references). A centered, specific outcome (`Booking confirmed` or `Request
 * sent`) states what happened, for what and when (in Philippine time), carries
 * one open loop only while the shop still has to decide, and always gives one
 * way forward plus the way back to the shop. The email note promises intent to
 * send, never delivery. Managing the booking (cancel, reschedule, a proposed
 * new time) stays on this page below the outcome.
 */
export default function Show({
    shop,
    branch,
    booking,
    urls,
}: BookingPageProps) {
    const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
    const cancellation = useForm({
        revision: booking.revision,
        idempotency_key: crypto.randomUUID(),
        reason: '',
        booking: '',
    });
    const reschedule = useForm({
        revision: booking.revision,
        idempotency_key: crypto.randomUUID(),
        start_at: '',
        booking: '',
    });
    // The picker's own wall-clock value; the form carries the UTC instant derived from it in the branch timezone.
    const [startLocal, setStartLocal] = useState('');
    // The outcome page is reached by navigation: announce it by focusing its heading once.
    const heading = useFocusOnChange<HTMLHeadingElement>(booking.publicId, {
        onMount: true,
    });
    const startField = useRef<HTMLInputElement>(null);
    const focusOutcome = useRef(false);
    const live = useBookingLive(booking.publicId, booking.actions.deadlineAt);
    // A reload brings a new revision: forms must submit it with a fresh key.
    const seenRevision = useRef(booking.revision);
    useEffect(() => {
        if (seenRevision.current === booking.revision) {
            return;
        }
        seenRevision.current = booking.revision;
        // Per-key updates keep the typed reason and chosen time.
        cancellation.setData('revision', booking.revision);
        cancellation.setData('idempotency_key', crypto.randomUUID());
        reschedule.setData('revision', booking.revision);
        reschedule.setData('idempotency_key', crypto.randomUUID());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booking.revision]);
    const conflict = Boolean(
        cancellation.errors.revision || reschedule.errors.revision,
    );
    const recover = () => {
        cancellation.clearErrors();
        reschedule.clearErrors();
        live.reload();
        heading.current?.focus();
    };
    const submitReschedule = () => {
        if (reschedule.processing || !startLocal) {
            return;
        }
        reschedule.post(urls.reschedule, {
            onSuccess: () => heading.current?.focus(),
            onError: (errors) => {
                if (errors.start_at) {
                    startField.current?.focus();
                }
            },
        });
    };
    const outcome = OUTCOMES[booking.status];
    const Icon =
        booking.status === 'confirmed'
            ? CircleCheckIcon
            : booking.status === 'pending_approval'
              ? ClockIcon
              : CircleXIcon;
    const emailNote =
        booking.status === 'confirmed' || booking.status === 'pending_approval';

    const manageable =
        booking.actions.canCancel || booking.actions.canReschedule;
    const pending = booking.status === 'pending_approval';
    const location = [shop.name, branch.city].filter(Boolean).join(' · ');
    const vehicle = vehicleLabel(booking.vehicleName, booking.vehicleMakeModel);
    const rows: DetailRow[] = [
        [
            'Service',
            [
                booking.serviceName,
                ...booking.addOns.map((addOn) => addOn.name),
            ].join(' + '),
        ],
        ['Vehicle', vehicle],
        [
            pending ? 'Requested start' : 'Start',
            formatLongDayAndTime(booking.startAt, booking.timezone),
        ],
        ...(pending && booking.pendingExpiresAt
            ? [
                  [
                      'Shop decision by',
                      formatLongDayAndTime(
                          booking.pendingExpiresAt,
                          booking.timezone,
                      ),
                  ] as DetailRow,
              ]
            : []),
        ['Duration', formatMinutes(booking.durationMinutes)],
        ...(pending
            ? []
            : [
                  [
                      'Service price',
                      formatCentavos(booking.totalCentavos),
                  ] as DetailRow,
              ]),
        ['Location', location],
    ];

    return (
        <>
            <Head title={outcome.title} />
            <div className={cn('grid gap-6', manageable && 'pb-36 lg:pb-0')}>
                <BookingJourneyHeader
                    shopName={shop.name}
                    shopUrl={urls.shop}
                    title="Your booking"
                    subtitle="Your appointment status and next steps"
                    crumb="Appointment result"
                    eyebrow="Your appointment"
                />
                <div className="mx-auto grid w-full max-w-[44rem] gap-5">
                    <div className="grid justify-items-center gap-2 text-center">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex size-16 items-center justify-center rounded-full lg:size-[4.5rem]',
                                DISC[outcome.tone],
                            )}
                        >
                            <Icon className="size-8" />
                        </span>
                        <h2
                            ref={heading}
                            tabIndex={-1}
                            className="mt-2 text-3xl font-semibold tracking-tight outline-none lg:text-4xl"
                        >
                            {outcome.title}
                        </h2>
                        <p
                            role="status"
                            className="max-w-[44ch] text-muted-foreground"
                        >
                            {booking.status === 'confirmed' ? (
                                <>
                                    Your appointment is confirmed with{' '}
                                    {shop.name}.
                                </>
                            ) : pending ? (
                                <>
                                    Your request is{' '}
                                    <strong className="font-semibold text-warning-text">
                                        not confirmed yet.
                                    </strong>{' '}
                                    The shop must review it.
                                </>
                            ) : (
                                <>
                                    {booking.serviceName} for your{' '}
                                    {booking.vehicleName} at {shop.name}.
                                </>
                            )}
                        </p>
                    </div>

                    <BookingLiveStatus
                        link={live.link}
                        refresh={live.refresh}
                        onRefresh={live.reload}
                    />
                    {conflict ? (
                        <Alert role="alert" className={ALERT_TONES.warning}>
                            <RefreshCwIcon aria-hidden="true" />
                            <AlertTitle>This booking changed</AlertTitle>
                            <AlertDescription>
                                <p>
                                    It was updated while you were viewing it, so
                                    your change was not applied. Load the latest
                                    details, then try again.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="max-sm:h-11"
                                    onClick={recover}
                                >
                                    Load latest details
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {booking.proposal ? (
                        <RescheduleProposalCard
                            proposal={booking.proposal}
                            originalStartAt={booking.startAt}
                            timezone={booking.timezone}
                            acceptUrl={urls.acceptProposal}
                            declineUrl={urls.declineProposal}
                        />
                    ) : null}

                    <section
                        aria-labelledby="appointment-heading"
                        className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7"
                    >
                        <h3
                            id="appointment-heading"
                            className="text-lg font-semibold"
                        >
                            {pending
                                ? 'Awaiting shop approval'
                                : 'Your appointment'}
                        </h3>
                        {pending ? (
                            <p
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border p-3 text-sm',
                                    ALERT_TONES.warning,
                                )}
                            >
                                <ClockIcon
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                />
                                Your requested time is temporarily held while{' '}
                                {shop.name} reviews it.
                            </p>
                        ) : null}
                        {booking.status === 'declined' ? (
                            <p className="text-sm">
                                The shop could not take this request, and the
                                time is no longer reserved.
                            </p>
                        ) : null}
                        {booking.status === 'expired' ? (
                            <p className="text-sm">
                                The shop did not respond in time, so the time is
                                no longer reserved.
                            </p>
                        ) : null}
                        <DetailRows rows={rows} />
                        {emailNote ? (
                            <p className="rounded-xl bg-secondary/70 p-3 text-sm text-muted-foreground">
                                {pending
                                    ? `We'll email ${booking.contactEmail} when the shop approves or declines this request. If there is no decision by the deadline, the request expires and the time is released.`
                                    : `We'll send the details by email to ${booking.contactEmail}. Delivery is not guaranteed until processed.`}
                            </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                            {branch.addressLine}, {branch.city}
                        </p>
                    </section>

                    {manageable ? (
                        <BookingActionBar
                            label="Next steps"
                            back={{ href: urls.shop, label: 'Back to shop' }}
                        >
                            <a
                                href="#manage-booking"
                                className={buttonVariants()}
                            >
                                {pending ? 'Track request' : 'Manage booking'}
                                <ArrowRightIcon aria-hidden="true" />
                            </a>
                        </BookingActionBar>
                    ) : (
                        <div className="flex justify-center">
                            <Link
                                href={urls.shop}
                                className={cn(buttonVariants(), 'max-sm:h-11')}
                            >
                                Back to {shop.name}
                            </Link>
                        </div>
                    )}
                </div>

                <div
                    id="manage-booking"
                    tabIndex={-1}
                    className="mx-auto grid w-full max-w-[44rem] scroll-mt-4 gap-5 outline-none"
                >
                    <Dialog
                        open={cancelConfirmationOpen}
                        onOpenChange={setCancelConfirmationOpen}
                    >
                        {booking.actions.canCancel ? (
                            <section
                                aria-labelledby="manage-booking-heading"
                                className="grid gap-3 rounded-2xl border border-border p-4"
                            >
                                <div className="grid gap-1">
                                    <h2
                                        id="manage-booking-heading"
                                        className="font-semibold"
                                    >
                                        Need to cancel?
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        You can cancel before the change
                                        deadline. This cannot be undone.
                                    </p>
                                </div>
                                <label
                                    className="grid gap-1 text-sm font-medium"
                                    htmlFor="cancellation-reason"
                                >
                                    Reason{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (optional)
                                    </span>
                                    <textarea
                                        id="cancellation-reason"
                                        value={cancellation.data.reason}
                                        maxLength={500}
                                        aria-invalid={
                                            cancellation.errors.reason
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            cancellation.errors.reason
                                                ? 'cancellation-reason-error'
                                                : undefined
                                        }
                                        onChange={(event) =>
                                            cancellation.setData(
                                                'reason',
                                                event.target.value,
                                            )
                                        }
                                        className={cn(
                                            FIELD_BORDER,
                                            'min-h-20 rounded-md px-3 py-2 font-normal',
                                        )}
                                    />
                                </label>
                                {cancellation.errors.booking ||
                                cancellation.errors.reason ? (
                                    <p
                                        id="cancellation-reason-error"
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {cancellation.errors.booking ??
                                            cancellation.errors.reason}
                                    </p>
                                ) : null}
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        disabled={cancellation.processing}
                                        className={cn(
                                            buttonVariants({
                                                variant: 'destructive',
                                            }),
                                            'w-full max-sm:h-11 sm:w-fit',
                                        )}
                                    >
                                        {cancellation.processing
                                            ? 'Cancelling…'
                                            : 'Cancel booking'}
                                    </button>
                                </DialogTrigger>
                            </section>
                        ) : booking.actions.reason ? (
                            <p className="text-sm text-muted-foreground">
                                {booking.actions.reason}
                            </p>
                        ) : null}
                        {booking.actions.canCancel &&
                        booking.actions.rescheduleReason ? (
                            <p className="text-sm text-muted-foreground">
                                {booking.actions.rescheduleReason}
                            </p>
                        ) : null}
                        {booking.actions.canReschedule ? (
                            <section
                                aria-labelledby="reschedule-heading"
                                className="grid gap-3 rounded-2xl border border-border p-4"
                            >
                                <div className="grid gap-1">
                                    <h2
                                        id="reschedule-heading"
                                        className="font-semibold"
                                    >
                                        Reschedule booking
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Choose another proposed time. We will
                                        confirm its current availability before
                                        changing your booking.
                                    </p>
                                </div>
                                <label
                                    className="grid gap-1 text-sm font-medium"
                                    htmlFor="reschedule-start"
                                >
                                    New date and time{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (Philippine time)
                                    </span>
                                    <input
                                        ref={startField}
                                        id="reschedule-start"
                                        type="datetime-local"
                                        required
                                        value={startLocal}
                                        aria-invalid={
                                            reschedule.errors.start_at
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            reschedule.errors.start_at ||
                                            reschedule.errors.booking
                                                ? 'reschedule-error'
                                                : undefined
                                        }
                                        onChange={(event) => {
                                            setStartLocal(event.target.value);
                                            reschedule.setData(
                                                'start_at',
                                                wallTimeToInstant(
                                                    event.target.value,
                                                    booking.timezone,
                                                ),
                                            );
                                        }}
                                        className={cn(
                                            FIELD_BORDER,
                                            'h-11 rounded-md px-3 font-normal',
                                        )}
                                    />
                                </label>
                                {reschedule.errors.start_at ||
                                reschedule.errors.booking ? (
                                    <p
                                        id="reschedule-error"
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {reschedule.errors.start_at ??
                                            reschedule.errors.booking}
                                    </p>
                                ) : null}
                                <button
                                    type="button"
                                    aria-disabled={
                                        reschedule.processing || !startLocal
                                    }
                                    onClick={submitReschedule}
                                    className={cn(
                                        buttonVariants(),
                                        'w-full max-sm:h-11 sm:w-fit',
                                        (reschedule.processing ||
                                            !startLocal) &&
                                            'pointer-events-none opacity-50',
                                    )}
                                >
                                    {reschedule.processing
                                        ? 'Rescheduling…'
                                        : 'Check and reschedule'}
                                </button>
                            </section>
                        ) : null}
                        <DialogContent
                            onCloseAutoFocus={(event) => {
                                // The trigger disappears once the booking is cancelled: land on the outcome instead.
                                if (focusOutcome.current) {
                                    event.preventDefault();
                                    focusOutcome.current = false;
                                    heading.current?.focus();
                                }
                            }}
                        >
                            <DialogHeader>
                                <DialogTitle>Cancel this booking?</DialogTitle>
                                <DialogDescription>
                                    This cannot be undone. The scheduled time
                                    will be released.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <button
                                    type="button"
                                    className={cn(
                                        buttonVariants({ variant: 'outline' }),
                                        'max-sm:h-11',
                                    )}
                                    onClick={() =>
                                        setCancelConfirmationOpen(false)
                                    }
                                >
                                    Keep booking
                                </button>
                                <button
                                    type="button"
                                    disabled={cancellation.processing}
                                    onClick={() =>
                                        cancellation.post(urls.cancel, {
                                            onSuccess: () => {
                                                focusOutcome.current = true;
                                            },
                                            onFinish: () =>
                                                setCancelConfirmationOpen(
                                                    false,
                                                ),
                                        })
                                    }
                                    className={cn(
                                        buttonVariants({
                                            variant: 'destructive',
                                        }),
                                        'max-sm:h-11',
                                    )}
                                >
                                    {cancellation.processing
                                        ? 'Cancelling…'
                                        : 'Cancel booking'}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </>
    );
}
