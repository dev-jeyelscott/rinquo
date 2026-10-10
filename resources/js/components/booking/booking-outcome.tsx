import { Link } from '@inertiajs/react';
import { CircleCheckIcon, CircleXIcon, ClockIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BookingPageProps, BookingStatus } from '@/types/booking';

type Tone = 'success' | 'warning' | 'error';
type Booking = BookingPageProps['booking'];

const OUTCOMES: Record<BookingStatus, { title: string; tone: Tone }> = {
    confirmed: { title: 'Booking confirmed', tone: 'success' },
    pending_approval: { title: 'Request sent', tone: 'warning' },
    declined: { title: 'Request declined', tone: 'error' },
    expired: { title: 'Request expired', tone: 'error' },
    cancelled: { title: 'Booking cancelled', tone: 'error' },
    rescheduled: { title: 'Booking rescheduled', tone: 'warning' },
};

/** The status disc above the outcome title: a tinted token surface, an icon and the title carry the meaning. */
const DISC: Record<Tone, string> = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-destructive/10 text-destructive',
};

/**
 * The outcome shown while work is under way or finished: the Approved Spec 02
 * `Booking confirmed` result stays for a booking that is merely scheduled or
 * checked in, and gives way to the operational result only once the shop has
 * started, completed or closed the appointment.
 */
export function outcomeOf(booking: Booking): { title: string; tone: Tone } {
    const state = booking.progress?.state;
    if (state === 'in_service') {
        return { title: 'Service in progress', tone: 'success' };
    }
    if (state === 'completed') {
        return { title: 'Service completed', tone: 'success' };
    }
    if (state === 'no_show') {
        return { title: 'Appointment missed', tone: 'error' };
    }

    return OUTCOMES[booking.status];
}

type Props = {
    booking: Booking;
    shopName: string;
    /** Receives focus when the page or booking changes, so the result is announced. */
    heading: RefObject<HTMLHeadingElement | null>;
    rescheduledTo: string | null;
};

/**
 * The centered result of a booking (Spec 02 outcome references): a status disc,
 * the specific title and one sentence of what that means. Pending is stated
 * as not confirmed yet; a moved booking links to its replacement.
 */
export function BookingOutcome({
    booking,
    shopName,
    heading,
    rescheduledTo,
}: Props) {
    const outcome = outcomeOf(booking);
    const pending = booking.status === 'pending_approval';
    const Icon =
        outcome.tone === 'success'
            ? CircleCheckIcon
            : pending
              ? ClockIcon
              : booking.status === 'rescheduled'
                ? ClockIcon
                : CircleXIcon;

    return (
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
            <p role="status" className="max-w-[44ch] text-muted-foreground">
                {booking.progress?.state === 'in_service' ? (
                    <>{shopName} is working on your vehicle now.</>
                ) : booking.progress?.state === 'completed' ? (
                    <>{shopName} marked your service complete.</>
                ) : booking.progress?.state === 'no_show' ? (
                    <>The shop recorded that this appointment was missed.</>
                ) : booking.status === 'confirmed' ? (
                    <>Your appointment is confirmed with {shopName}.</>
                ) : pending ? (
                    <>
                        Your request is{' '}
                        <strong className="font-semibold text-warning-text">
                            not confirmed yet.
                        </strong>{' '}
                        The shop must review it.
                    </>
                ) : booking.status === 'cancelled' ? (
                    <>
                        Your {booking.serviceName} booking was cancelled and the
                        time was released.
                    </>
                ) : booking.status === 'rescheduled' ? (
                    <>
                        This appointment moved to a new time. Your new booking
                        has the same service and price.
                    </>
                ) : (
                    <>
                        {booking.serviceName} for your {booking.vehicleName} at{' '}
                        {shopName}.
                    </>
                )}
            </p>
            {booking.status === 'rescheduled' && rescheduledTo ? (
                <Link
                    href={rescheduledTo}
                    className={cn(buttonVariants(), 'max-sm:h-11')}
                >
                    View your new booking
                </Link>
            ) : null}
        </div>
    );
}
