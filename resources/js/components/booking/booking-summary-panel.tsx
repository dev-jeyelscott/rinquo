import { formatInstant } from '@/lib/datetime';
import { formatMinutes } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { vehicleLabel } from '@/components/booking/booking-summary-card';
import type { BookingPageProps, BookingStatus } from '@/types/booking';

type Booking = BookingPageProps['booking'];

type Tone = 'success' | 'warning' | 'primary' | 'error' | 'neutral';

const BADGE: Record<Tone, string> = {
    success: 'bg-success/15 text-success-text',
    warning: 'bg-warning/15 text-warning-text',
    primary: 'bg-primary/10 text-primary',
    error: 'bg-destructive/10 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
};

const STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
    confirmed: { label: 'Confirmed', tone: 'success' },
    pending_approval: { label: 'Awaiting approval', tone: 'warning' },
    declined: { label: 'Declined', tone: 'error' },
    expired: { label: 'Expired', tone: 'neutral' },
    cancelled: { label: 'Cancelled', tone: 'error' },
    rescheduled: { label: 'Rescheduled', tone: 'neutral' },
};

/** The badge words: the lifecycle status, or the operational step once a confirmed booking is under way. */
function badgeOf(booking: Booking): { label: string; tone: Tone } {
    const state = booking.progress?.state;
    if (state === 'checked_in') {
        return { label: 'Checked in', tone: 'primary' };
    }
    if (state === 'in_service') {
        return { label: 'In service', tone: 'primary' };
    }
    if (state === 'completed') {
        return { label: 'Completed', tone: 'success' };
    }
    if (state === 'no_show') {
        return { label: 'Missed', tone: 'error' };
    }

    if (booking.actions.restricted) {
        return { label: 'Changes limited', tone: 'warning' };
    }

    return STATUS[booking.status];
}

type Props = {
    booking: Booking;
    shopName: string;
    addressLine: string;
    city: string;
};

/**
 * The persistent booking summary beside the management and staged views (Spec
 * 03 references): a status badge, the appointment date tile, then where, what,
 * which vehicle and who. Every value is the customer-safe booking the server
 * sent; the status is spelled out in the badge so colour never carries it.
 */
export function BookingSummaryPanel({
    booking,
    shopName,
    addressLine,
    city,
}: Props) {
    const badge = badgeOf(booking);
    const zone = booking.timezone;
    const month = formatInstant(booking.startAt, zone, { month: 'short' });
    const day = formatInstant(booking.startAt, zone, { day: 'numeric' });
    const time = formatInstant(booking.startAt, zone, {
        hour: 'numeric',
        minute: '2-digit',
    });
    const date = formatInstant(booking.startAt, zone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const service = [
        booking.serviceName,
        ...booking.addOns.map((addOn) => addOn.name),
    ].join(' + ');
    const rows: [label: string, value: string, note?: string][] = [
        ['Location', shopName, [addressLine, city].filter(Boolean).join(', ')],
        [
            'Service',
            service,
            `Approx. ${formatMinutes(booking.durationMinutes)}`,
        ],
        [
            'Vehicle',
            vehicleLabel(booking.vehicleName, booking.vehicleMakeModel),
        ],
        ['Customer', booking.contactName],
    ];

    return (
        <section
            aria-labelledby="booking-summary-panel-heading"
            className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
        >
            <div className="flex items-center justify-between gap-3">
                <h2
                    id="booking-summary-panel-heading"
                    className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                >
                    Your booking
                </h2>
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                        BADGE[badge.tone],
                    )}
                >
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                    />
                    {badge.label}
                </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div
                    aria-hidden="true"
                    className="grid w-14 shrink-0 justify-items-center rounded-lg border bg-card py-1.5 leading-none"
                >
                    <span className="text-[0.6875rem] font-bold tracking-wide text-primary uppercase">
                        {month}
                    </span>
                    <span className="mt-1 text-2xl font-bold tabular-nums">
                        {day}
                    </span>
                </div>
                <div className="grid gap-0.5">
                    <p className="text-xl font-semibold tabular-nums">{time}</p>
                    <p className="text-xs text-foreground/80">
                        {date} · Philippine time
                    </p>
                </div>
            </div>
            <dl className="grid text-sm">
                {rows.map(([label, value, note]) => (
                    <div
                        key={label}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
                    >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right">
                            <span className="font-semibold">{value}</span>
                            {note ? (
                                <span className="block text-xs text-muted-foreground">
                                    {note}
                                </span>
                            ) : null}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
