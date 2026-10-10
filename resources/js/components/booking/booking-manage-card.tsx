import { Link } from '@inertiajs/react';
import {
    CircleCheckIcon,
    ClockIcon,
    InfoIcon,
    TriangleAlertIcon,
} from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import {
    formatDayAndTime,
    formatLongDayAndTime,
    formatTime,
} from '@/lib/booking-format';
import { formatMinutes } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { BookingPageProps } from '@/types/booking';

type Booking = BookingPageProps['booking'];

const ACTION = 'max-sm:h-11 max-sm:flex-1';

type CardProps = {
    booking: Booking;
    shopName: string;
    /** The live-updates indicator (or its alert), placed in the card header. */
    liveStatus: ReactNode;
    /** Receives focus when the customer comes back from a staged view. */
    heading: RefObject<HTMLHeadingElement | null>;
    onReschedule: () => void;
    onCancel: () => void;
};

/**
 * The management region of a confirmed or pending booking (Spec 03 confirmed,
 * pending and restricted references): what the booking currently is in one
 * sentence, then a choice between changing the time and cancelling, with the
 * change deadline stated. Neither action opens a form here; each starts its own
 * staged view, so nothing is destructive from this card. When rescheduling is
 * withdrawn (a restricted shop, a staff proposal, a changed catalogue) the
 * button stays visible, says it is unavailable and points at the written
 * reason; cancelling stays reachable.
 */
export function BookingManageCard({
    booking,
    shopName,
    liveStatus,
    heading,
    onReschedule,
    onCancel,
}: CardProps) {
    const pending = booking.status === 'pending_approval';
    const { actions } = booking;
    const limited = actions.canCancel && !actions.canReschedule;
    const deadline = actions.deadlineAt
        ? formatLongDayAndTime(actions.deadlineAt, booking.timezone).replace(
              ' · ',
              ' at ',
          )
        : null;

    return (
        <>
            {limited && actions.rescheduleReason && !booking.proposal ? (
                <Alert role={undefined} className={ALERT_TONES.warning}>
                    <TriangleAlertIcon aria-hidden="true" />
                    <AlertTitle>
                        {actions.restricted
                            ? 'Rescheduling is temporarily unavailable'
                            : 'Rescheduling is unavailable'}
                    </AlertTitle>
                    <AlertDescription id="reschedule-unavailable">
                        {actions.rescheduleReason}
                    </AlertDescription>
                </Alert>
            ) : null}
            <section
                aria-labelledby="manage-booking-heading"
                className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
            >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <h3
                        id="manage-booking-heading"
                        ref={heading}
                        tabIndex={-1}
                        className="text-lg font-semibold outline-none"
                    >
                        {pending
                            ? 'Your booking request'
                            : 'Manage your appointment'}
                    </h3>
                    {liveStatus}
                </div>
                {pending ? (
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-xl border p-3 text-sm',
                            ALERT_TONES.warning,
                        )}
                    >
                        <ClockIcon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-warning"
                        />
                        <div className="grid gap-0.5">
                            <p className="font-semibold text-warning-text">
                                Awaiting the shop&apos;s decision
                            </p>
                            <p>
                                This request is not yet confirmed.
                                {booking.pendingExpiresAt
                                    ? ` The shop will decide by ${formatDayAndTime(booking.pendingExpiresAt, booking.timezone)}.`
                                    : ''}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-xl border p-3 text-sm',
                            ALERT_TONES.success,
                        )}
                    >
                        <CircleCheckIcon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-success"
                        />
                        <div className="grid gap-0.5">
                            <p className="font-semibold text-success-text">
                                You&apos;re all set
                            </p>
                            <p>
                                Your appointment is confirmed for{' '}
                                {formatLongDayAndTime(
                                    booking.startAt,
                                    booking.timezone,
                                ).replace(' · ', ' at ')}
                                .
                            </p>
                        </div>
                    </div>
                )}
                <div className="grid gap-3 border-t pt-4">
                    <h4 className="text-sm font-semibold">
                        {limited
                            ? 'Manage your booking'
                            : 'What would you like to do?'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {actions.canReschedule ? (
                            <button
                                type="button"
                                className={cn(buttonVariants(), ACTION)}
                                onClick={onReschedule}
                            >
                                Choose another time
                            </button>
                        ) : actions.rescheduleReason ? (
                            <button
                                type="button"
                                aria-disabled="true"
                                aria-describedby="reschedule-unavailable"
                                className={cn(
                                    buttonVariants({ variant: 'secondary' }),
                                    ACTION,
                                    'cursor-not-allowed text-muted-foreground',
                                )}
                            >
                                Reschedule unavailable
                            </button>
                        ) : null}
                        {actions.canCancel ? (
                            <button
                                type="button"
                                className={cn(
                                    buttonVariants({
                                        variant: limited
                                            ? 'destructive'
                                            : 'outline',
                                    }),
                                    ACTION,
                                    !limited && 'border-booking-control',
                                )}
                                onClick={onCancel}
                            >
                                Cancel booking
                            </button>
                        ) : null}
                    </div>
                    {limited && deadline ? (
                        <p className="text-sm text-muted-foreground">
                            You may still cancel this booking before {deadline}.
                        </p>
                    ) : null}
                    {limited && actions.rescheduleReason ? (
                        <p
                            id={
                                booking.proposal
                                    ? 'reschedule-unavailable'
                                    : undefined
                            }
                            className="text-xs text-muted-foreground"
                        >
                            {booking.proposal
                                ? `${actions.rescheduleReason} `
                                : ''}
                            Your original appointment is still reserved at{' '}
                            {shopName}. Do not cancel unless you want to release
                            it.
                        </p>
                    ) : null}
                    {deadline && !limited ? (
                        <p className="text-xs text-muted-foreground">
                            Changes are available until {deadline}. After that,
                            contact the shop.
                        </p>
                    ) : null}
                </div>
            </section>
        </>
    );
}

/** The quiet "Stay informed" notice that follows the management card (confirmed and pending references). */
export function StayInformed({ email }: { email: string }) {
    return (
        <Alert role={undefined} className={ALERT_TONES.info}>
            <InfoIcon aria-hidden="true" />
            <AlertTitle>Stay informed</AlertTitle>
            <AlertDescription>
                We&apos;ll send updates to {email}. Email delivery is not
                guaranteed until processed.
            </AlertDescription>
        </Alert>
    );
}

/**
 * The state after the self-service deadline (Spec 03 cutoff reference): the
 * closed deadline in words, the only route left (the shop) and a statement
 * that no change controls exist, so nothing appears disabled and unexplained.
 */
export function BookingCutoffNotice({
    shopUrl,
    phone,
    closedAt,
    startAt,
    timezone,
}: {
    shopUrl: string;
    /** The shop's public phone, when it has published one: the only contact route the customer-safe page carries. */
    phone: string | null;
    closedAt: string | null;
    startAt: string;
    timezone: string;
}) {
    const early = closedAt
        ? Math.round(
              (new Date(startAt).getTime() - new Date(closedAt).getTime()) /
                  60000,
          )
        : 0;

    return (
        <>
            <Alert role={undefined} className={ALERT_TONES.warning}>
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>The change deadline has passed</AlertTitle>
                <AlertDescription>
                    {closedAt
                        ? `Self-service cancellation and rescheduling closed at ${formatTime(closedAt, timezone)}${early > 0 ? `, ${formatMinutes(early)} before this appointment` : ''}.`
                        : 'Self-service cancellation and rescheduling have closed for this appointment.'}
                </AlertDescription>
            </Alert>
            <section
                aria-labelledby="cutoff-heading"
                className="grid gap-3 rounded-2xl border bg-card p-5 sm:p-6"
            >
                <h3 id="cutoff-heading" className="text-lg font-semibold">
                    Need to make a change?
                </h3>
                <p className="text-sm text-muted-foreground">
                    Only the shop can review an exception after the deadline.
                    Your current appointment remains confirmed unless the shop
                    changes it.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={shopUrl}
                        className={cn(
                            buttonVariants({ variant: 'outline' }),
                            ACTION,
                            'border-booking-control',
                        )}
                    >
                        Back to shop
                    </Link>
                    {phone ? (
                        <a
                            href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                            className={cn(buttonVariants(), ACTION)}
                        >
                            Contact the shop
                        </a>
                    ) : null}
                </div>
            </section>
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Cancellation and rescheduling controls are unavailable because
                the deadline has passed.
            </p>
        </>
    );
}
