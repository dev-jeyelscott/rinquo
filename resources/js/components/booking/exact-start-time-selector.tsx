import { CircleAlertIcon, WifiOffIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import { formatLocalDate, formatTime } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type {
    BookingDate,
    DayAvailability,
    NextAvailable,
} from '@/types/booking';

export type SelectorStatus = 'ready' | 'loading' | 'error' | 'offline';

type Props = {
    dates: BookingDate[];
    selectedDate: string | null;
    onDateChange: (date: string) => void;
    status: SelectorStatus;
    availability: DayAvailability | null;
    selectedStart: string | null;
    onSelect: (startAt: string | null) => void;
    nextAvailable: NextAvailable;
    /** True once the next available start has been looked up (null result included). */
    nextKnown: boolean;
    onNextAvailable: () => void;
    onRetry: () => void;
    timezone: string;
    /** Shop phone, offered when nothing can be booked online. */
    phone: string | null;
};

const chip =
    'h-auto min-h-11 min-w-0 flex-col gap-0 rounded-lg border border-input bg-card px-3 py-2 tabular-nums first:rounded-lg last:rounded-lg data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:line-through';

/**
 * Exact start time selection (reference 02): a date strip over the booking
 * horizon and a grid of start-time chips. Unavailable times stay visible but
 * disabled, named "9:00 AM, unavailable" and struck through so colour is never
 * the only signal. It renders a specific message and a recovery action for
 * loading, closed, empty, no-availability, error and offline conditions, and
 * announces the chosen time in a polite live region. It never receives or
 * shows capacity, units, resources or why a time is unavailable.
 */
export function ExactStartTimeSelector({
    dates,
    selectedDate,
    onDateChange,
    status,
    availability,
    selectedStart,
    onSelect,
    nextAvailable,
    nextKnown,
    onNextAvailable,
    onRetry,
    timezone,
    phone,
}: Props) {
    const showSkeleton = useDelayedFlag(status === 'loading');
    const dayLabel = selectedDate ? formatLocalDate(selectedDate) : '';

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <h3 id="date-strip-heading" className="text-sm font-semibold">
                    Date
                </h3>
                <ToggleGroup
                    type="single"
                    value={selectedDate ?? ''}
                    onValueChange={(value) => value && onDateChange(value)}
                    aria-labelledby="date-strip-heading"
                    className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-1"
                >
                    {dates.map((day) => (
                        <ToggleGroupItem
                            key={day.date}
                            value={day.date}
                            disabled={day.closed}
                            aria-label={`${formatLocalDate(day.date)}${day.closed ? ', closed' : ''}`}
                            className={cn(chip, 'min-w-16')}
                        >
                            <span className="text-xs">
                                {formatLocalDate(day.date, {
                                    weekday: 'short',
                                })}
                            </span>
                            <span className="text-base font-semibold">
                                {formatLocalDate(day.date, { day: 'numeric' })}
                            </span>
                            <span className="text-xs">
                                {day.closed
                                    ? 'Closed'
                                    : formatLocalDate(day.date, {
                                          month: 'short',
                                      })}
                            </span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                        id="time-grid-heading"
                        className="text-sm font-semibold"
                    >
                        Start time
                    </h3>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:h-11"
                        disabled={
                            !nextKnown ||
                            nextAvailable === null ||
                            status === 'loading'
                        }
                        onClick={onNextAvailable}
                    >
                        {!nextKnown || status === 'loading' ? (
                            <>
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                                Checking times…
                            </>
                        ) : (
                            'Next available'
                        )}
                    </Button>
                </div>

                <TimesBody
                    status={status}
                    showSkeleton={showSkeleton}
                    availability={availability}
                    dayLabel={dayLabel}
                    selectedStart={selectedStart}
                    onSelect={onSelect}
                    nextAvailable={nextAvailable}
                    nextKnown={nextKnown}
                    onNextAvailable={onNextAvailable}
                    onRetry={onRetry}
                    timezone={timezone}
                    phone={phone}
                />

                <p role="status" className="sr-only">
                    {selectedStart
                        ? `Selected ${formatTime(selectedStart, timezone)} on ${dayLabel}.`
                        : ''}
                </p>
            </div>
        </div>
    );
}

type BodyProps = Pick<
    Props,
    | 'status'
    | 'availability'
    | 'selectedStart'
    | 'onSelect'
    | 'nextAvailable'
    | 'nextKnown'
    | 'onNextAvailable'
    | 'onRetry'
    | 'timezone'
    | 'phone'
> & { showSkeleton: boolean; dayLabel: string };

function TimesBody({
    status,
    showSkeleton,
    availability,
    dayLabel,
    selectedStart,
    onSelect,
    nextAvailable,
    nextKnown,
    onNextAvailable,
    onRetry,
    timezone,
    phone,
}: BodyProps) {
    if (status === 'offline' || status === 'error') {
        const offline = status === 'offline';

        return (
            <Alert className={ALERT_TONES.error}>
                {offline ? (
                    <WifiOffIcon aria-hidden="true" />
                ) : (
                    <CircleAlertIcon aria-hidden="true" />
                )}
                <AlertTitle>
                    {offline
                        ? 'You appear to be offline'
                        : `We couldn't load times for ${dayLabel}`}
                </AlertTitle>
                <AlertDescription>
                    <p>
                        {offline
                            ? 'Nothing has been reserved. Reconnect, then try again.'
                            : 'Nothing has been reserved. Your vehicle, service and date are kept.'}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:h-11"
                        onClick={onRetry}
                    >
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    if (status === 'loading' && showSkeleton) {
        return (
            <div aria-busy="true">
                <p role="status" className="sr-only">
                    Checking times…
                </p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                    {Array.from({ length: 12 }, (_, index) => (
                        <Skeleton
                            key={index}
                            aria-hidden="true"
                            className="h-11 rounded-lg"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (availability === null) {
        return null;
    }

    if (nextKnown && nextAvailable === null) {
        return (
            <Alert className={ALERT_TONES.warning}>
                <CircleAlertIcon aria-hidden="true" />
                <AlertTitle>No times are available online right now</AlertTitle>
                <AlertDescription>
                    <p>
                        Every time in the booking window is taken. Please check
                        back later
                        {phone ? ' or call the shop to ask about a slot' : ''}.
                    </p>
                    {phone ? (
                        <a
                            href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                            className="text-primary underline underline-offset-4"
                        >
                            {phone}
                        </a>
                    ) : null}
                </AlertDescription>
            </Alert>
        );
    }

    if (availability.closed || availability.times.length === 0) {
        return (
            <Alert className={ALERT_TONES.info}>
                <CircleAlertIcon aria-hidden="true" />
                <AlertTitle>
                    {availability.closed
                        ? `The shop is closed on ${dayLabel}`
                        : `No times left on ${dayLabel}`}
                </AlertTitle>
                <AlertDescription>
                    <p>
                        Choose another date
                        {nextAvailable ? ' or jump to the earliest time.' : '.'}
                    </p>
                    {nextAvailable ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-sm:h-11"
                            onClick={onNextAvailable}
                        >
                            Next available
                        </Button>
                    ) : null}
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <ToggleGroup
            type="single"
            value={selectedStart ?? ''}
            onValueChange={(value) => onSelect(value === '' ? null : value)}
            aria-labelledby="time-grid-heading"
            className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2"
        >
            {availability.times.map((slot) => {
                const label = formatTime(slot.startAt, timezone);

                return (
                    <ToggleGroupItem
                        key={slot.startAt}
                        value={slot.startAt}
                        disabled={!slot.available}
                        aria-label={
                            slot.available ? label : `${label}, unavailable`
                        }
                        className={chip}
                    >
                        {label}
                    </ToggleGroupItem>
                );
            })}
        </ToggleGroup>
    );
}
