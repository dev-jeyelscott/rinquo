import { CheckIcon, ClockIcon } from 'lucide-react';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type {
    BookingHistoryEntry,
    BookingHistoryKind,
    OperationalProgress,
} from '@/types/booking';

const STEPS = [
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'checked_in', label: 'Checked in' },
    { key: 'in_service', label: 'In service' },
    { key: 'completed', label: 'Completed' },
] as const;

/** Index of the step the booking is on; a finished booking is past the last step. */
function position(state: OperationalProgress['state']): number {
    switch (state) {
        case 'checked_in':
            return 1;
        case 'in_service':
            return 2;
        case 'completed':
            return STEPS.length;
        default:
            return 0;
    }
}

function summary(progress: OperationalProgress, timezone: string): string {
    if (progress.state === 'in_service') {
        const ending = progress.projectedEndAt
            ? ` Expected to finish around ${formatDayAndTime(progress.projectedEndAt, timezone)}.`
            : '';

        return progress.delayed
            ? `Your vehicle is being serviced, running about ${formatMinutes(progress.delayMinutes)} behind.${ending}`
            : `Your vehicle is being serviced. No action is needed from you.${ending}`;
    }
    if (progress.state === 'checked_in') {
        return progress.delayed
            ? `The shop checked you in, but service is taking about ${formatMinutes(progress.delayMinutes)} longer to start than planned. This page updates when it starts.`
            : 'The shop checked you in. Service starts next. Arrival is recorded by shop staff; there is no self check-in.';
    }
    if (progress.state === 'completed') {
        return 'The service was completed. Your booking is now a historical record.';
    }
    if (progress.state === 'no_show') {
        return 'The shop recorded that this appointment was missed.';
    }

    return 'The shop will record your arrival and each step of the service here.';
}

type ProgressProps = { progress: OperationalProgress; timezone: string };

/**
 * Operational progress of a confirmed booking (Spec 03 progress references):
 * Confirmed, Checked in, In service, Completed as an ordered list whose every
 * item says in words whether it is done, current or upcoming, so colour never
 * carries the meaning. A delay is a labelled note, derived by the server from
 * the projection; the page never guesses a new arrival time.
 */
export function BookingProgress({ progress, timezone }: ProgressProps) {
    const current = position(progress.state);
    const missed = progress.state === 'no_show';

    return (
        <section
            aria-labelledby="booking-progress-heading"
            className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7"
        >
            <h3 id="booking-progress-heading" className="text-lg font-semibold">
                Booking progress
            </h3>
            {missed ? null : (
                <ol className="grid grid-cols-4 gap-2">
                    {STEPS.map((step, index) => {
                        const done = index < current;
                        const active = index === current;

                        return (
                            <li
                                key={step.key}
                                aria-current={active ? 'step' : undefined}
                                className="grid justify-items-center gap-1.5 text-center text-xs font-medium sm:text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex size-8 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                                        done &&
                                            'border-success bg-success text-success-foreground',
                                        active &&
                                            'border-primary bg-primary text-primary-foreground',
                                        !done &&
                                            !active &&
                                            'bg-background text-muted-foreground',
                                    )}
                                >
                                    {done ? (
                                        <CheckIcon className="size-4" />
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        done && 'text-success-text',
                                        active && 'text-primary',
                                        !done &&
                                            !active &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    {step.label}
                                    <span className="sr-only">
                                        {done
                                            ? ', done'
                                            : active
                                              ? ', current'
                                              : ', upcoming'}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
            <p
                className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 text-sm',
                    progress.delayed ? ALERT_TONES.warning : ALERT_TONES.info,
                )}
            >
                {progress.delayed ? (
                    <ClockIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                ) : null}
                <span>
                    {progress.delayed ? <strong>Delayed. </strong> : null}
                    {summary(progress, timezone)}
                </span>
            </p>
        </section>
    );
}

const HISTORY_LABELS: Record<BookingHistoryKind, string> = {
    requested: 'Request sent',
    confirmed: 'Confirmed',
    declined: 'Declined by the shop',
    expired: 'Request expired',
    checked_in: 'Arrived',
    in_service: 'Service started',
    completed: 'Completed',
    no_show: 'Marked as missed',
    cancelled: 'Cancelled',
    rescheduled: 'Moved to a new time',
};

/**
 * The durable, customer-safe history of a booking: kind and instant only, in
 * order, in the shop's timezone. It never carries who did it or why.
 */
export function BookingHistory({
    entries,
    timezone,
    note,
}: {
    entries: BookingHistoryEntry[];
    timezone: string;
    /** A closing line, for example that a finished booking can no longer be changed. */
    note?: string;
}) {
    return (
        <section
            aria-labelledby="booking-history-heading"
            className="grid gap-3 rounded-2xl border bg-card p-5 sm:p-7"
        >
            <h3 id="booking-history-heading" className="text-lg font-semibold">
                Appointment history
            </h3>
            <ol className="grid text-sm">
                {entries.map((entry) => (
                    <li
                        key={`${entry.kind}-${entry.at}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 border-b py-2.5 first:pt-0 last:border-b-0"
                    >
                        <span className="text-muted-foreground">
                            {HISTORY_LABELS[entry.kind]}
                        </span>
                        <span className="font-semibold tabular-nums">
                            {formatDayAndTime(entry.at, timezone)}
                        </span>
                    </li>
                ))}
            </ol>
            {note ? (
                <p className="text-sm text-muted-foreground">{note}</p>
            ) : null}
        </section>
    );
}
