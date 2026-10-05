import { Head, Link } from '@inertiajs/react';
import { CircleCheckIcon, ClockIcon, CircleXIcon } from 'lucide-react';
import { BookingSummaryCard } from '@/components/booking/booking-summary-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { formatDayAndTime } from '@/lib/booking-format';
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
};

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
                <h1 className="text-3xl font-semibold tracking-tight">
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
            </div>
        </>
    );
}
