import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    CircleCheckIcon,
    ClockIcon,
    CircleXIcon,
    RefreshCwIcon,
} from 'lucide-react';
import { BookingLiveStatus } from '@/components/booking/booking-live-status';
import { BookingSummaryCard } from '@/components/booking/booking-summary-card';
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
import { formatDayAndTime, wallTimeToInstant } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { BookingPageProps, BookingStatus } from '@/types/booking';

const OUTCOMES: Record<
    BookingStatus,
    { title: string; tone: keyof typeof ALERT_TONES }
> = {
    confirmed: { title: 'Booking confirmed', tone: 'success' },
    pending_approval: { title: 'Request sent', tone: 'warning' },
    declined: { title: 'Request declined', tone: 'error' },
    expired: { title: 'Request expired', tone: 'error' },
    cancelled: { title: 'Booking cancelled', tone: 'error' },
    rescheduled: { title: 'Booking rescheduled', tone: 'warning' },
};

/** Form controls on this page need a boundary of at least 3:1 (WCAG 1.4.11); the field token is near-white. */
const FIELD_BORDER = 'border border-muted-foreground bg-background';

/**
 * The durable result of a booking, at its own URL. It states what happened,
 * for what and when (in Philippine time), carries one open loop only while the
 * shop still has to decide, and always gives one way forward. The email note is
 * neutral: it never claims the message was delivered.
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
    const heading = useRef<HTMLHeadingElement>(null);
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

    return (
        <>
            <Head title={outcome.title} />
            <div className="mx-auto grid w-full max-w-2xl gap-5">
                <h1
                    ref={heading}
                    tabIndex={-1}
                    className="text-3xl font-semibold tracking-tight outline-none"
                >
                    {outcome.title}
                </h1>
                <Alert
                    role="status"
                    className={cn('rounded-2xl', ALERT_TONES[outcome.tone])}
                >
                    <Icon aria-hidden="true" />
                    <AlertTitle className="line-clamp-none">
                        {booking.serviceName} for your {booking.vehicleName}
                    </AlertTitle>
                    <AlertDescription className="text-foreground">
                        <p className="tabular-nums">
                            {formatDayAndTime(
                                booking.startAt,
                                booking.timezone,
                            )}{' '}
                            (Philippine time) at {shop.name}
                        </p>
                        {booking.status === 'pending_approval' &&
                        booking.pendingExpiresAt ? (
                            <p>
                                The shop will confirm by{' '}
                                <span className="font-semibold tabular-nums">
                                    {formatDayAndTime(
                                        booking.pendingExpiresAt,
                                        booking.timezone,
                                    )}
                                </span>
                                . Your time is held until then.
                            </p>
                        ) : null}
                        {booking.status === 'declined' ? (
                            <p>
                                The shop could not take this request, and the
                                time is no longer reserved.
                            </p>
                        ) : null}
                        {booking.status === 'expired' ? (
                            <p>
                                The shop did not respond in time, so the time is
                                no longer reserved.
                            </p>
                        ) : null}
                    </AlertDescription>
                </Alert>

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

                <BookingSummaryCard
                    heading="Booking details"
                    vehicleName={booking.vehicleName}
                    serviceName={booking.serviceName}
                    addOns={booking.addOns}
                    totalCentavos={booking.totalCentavos}
                    durationMinutes={booking.durationMinutes}
                    bufferMinutes={booking.bufferMinutes}
                    startAt={booking.startAt}
                    timezone={booking.timezone}
                />

                <div className="grid gap-1 text-sm">
                    <p className="font-semibold">{shop.name}</p>
                    <p className="text-muted-foreground">
                        {branch.addressLine}, {branch.city}
                    </p>
                    {emailNote ? (
                        <p className="text-muted-foreground">
                            An email to {booking.contactEmail} is on its way.
                        </p>
                    ) : null}
                </div>

                <div>
                    <Link
                        href={urls.shop}
                        className={cn(buttonVariants(), 'max-sm:h-11')}
                    >
                        Back to {shop.name}
                    </Link>
                </div>

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
                                    You can cancel before the change deadline.
                                    This cannot be undone.
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
                                    (reschedule.processing || !startLocal) &&
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
                                This cannot be undone. The scheduled time will
                                be released.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <button
                                type="button"
                                className={cn(
                                    buttonVariants({ variant: 'outline' }),
                                    'max-sm:h-11',
                                )}
                                onClick={() => setCancelConfirmationOpen(false)}
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
                                            setCancelConfirmationOpen(false),
                                    })
                                }
                                className={cn(
                                    buttonVariants({ variant: 'destructive' }),
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
        </>
    );
}
