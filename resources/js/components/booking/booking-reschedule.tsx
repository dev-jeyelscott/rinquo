import { ArrowRightIcon, InfoIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { DetailRows } from '@/components/booking/booking-summary-card';
import type { DetailRow } from '@/components/booking/booking-summary-card';
import { ExactStartTimeSelector } from '@/components/booking/exact-start-time-selector';
import { StepIndicator } from '@/components/booking/step-indicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import type { BookingManagement } from '@/hooks/use-booking-management';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { useReplacementAvailability } from '@/hooks/use-replacement-availability';
import { formatDayAndTime } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type {
    BookingDate,
    DayAvailability,
    NextAvailable,
} from '@/types/booking';

export type RescheduleStep = 'select' | 'review';

const STEPS = [
    { key: 'select', label: 'Choose a time' },
    { key: 'review', label: 'Review change' },
    { key: 'done', label: 'Done' },
] as const;

type Props = {
    form: BookingManagement['reschedule'];
    /** POST target of the reschedule. */
    url: string;
    /** The booking page itself: replacement availability is a partial reload of it. */
    pageUrl: string;
    startAt: string;
    timezone: string;
    summaryRows: readonly DetailRow[];
    phone: string | null;
    dates: BookingDate[] | null | undefined;
    availability: DayAvailability | null | undefined;
    next: NextAvailable | undefined;
    step: RescheduleStep;
    onStep: (step: RescheduleStep) => void;
    /** Leaves the reschedule view without changing anything. */
    onLeave: () => void;
};

/**
 * Rescheduling (Spec 03 reschedule references) as its own staged view with a
 * three-stage indicator (Choose a time, Review change, Done), so the booking
 * context stays beside it and nothing is destructive until the last step.
 * Step 1 selects an exact start from server-authored availability for the
 * booked service terms (the shared selector: unavailable times stay visible
 * and disabled without reasons; loading after 300 ms; offline, error, empty
 * and no-time states each name the condition and a recovery). Selecting
 * changes nothing. Step 2 reviews the current and the requested time side by
 * side and only then sends the one critical request. A displayed time is never
 * a reservation: the server revalidates it, and when it refuses, the original
 * booking is untouched and the customer is returned to Step 1 with the reason.
 * The step state lives in the page (it names the view); "Done" is the
 * replacement booking's own page.
 */
export function BookingReschedule({
    form,
    url,
    pageUrl,
    startAt,
    timezone,
    summaryRows,
    phone,
    dates,
    availability,
    next,
    step,
    onStep,
    onLeave,
}: Props) {
    const [network, setNetwork] = useState(false);
    const [nudge, setNudge] = useState(false);
    const picker = useReplacementAvailability({
        url: pageUrl,
        timezone,
        enabled: true,
        dates,
        availability,
        next,
    });
    const stepHeading = useFocusOnChange<HTMLHeadingElement>(step, {
        onMount: true,
    });
    const errorField = useRef<HTMLParagraphElement>(null);
    const message =
        form.errors.start_at ??
        form.errors.booking ??
        form.errors.idempotency_key;
    const chosen = picker.startAt;
    // Times of another day are never shown under the selected one while it loads.
    const shown =
        availability && availability.date === picker.date ? availability : null;

    // A rejection is perceivable the moment it arrives: focus moves to the written reason.
    useEffect(() => {
        if (message) {
            errorField.current?.focus();
        }
    }, [message]);

    const select = (value: string | null) => {
        picker.select(value);
        form.setData('start_at', value ?? '');
        setNudge(false);
    };
    const review = () => {
        if (chosen) {
            onStep('review');
        } else {
            setNudge(true);
        }
    };
    const confirm = () => {
        if (form.processing || !chosen || !picker.online) {
            return;
        }
        setNetwork(false);
        form.post(url, {
            onError: (errors) => {
                if (errors.start_at) {
                    // The server judged the time taken or invalid: back to a fresh list.
                    onStep('select');
                    picker.refreshDay();
                    form.setData('start_at', '');
                }
            },
            onNetworkError: () => setNetwork(true),
        });
    };

    return (
        <section
            aria-labelledby="reschedule-heading"
            className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-2xl border bg-card p-5 sm:p-6"
        >
            <h2 id="reschedule-heading" className="sr-only">
                Reschedule booking
            </h2>
            <StepIndicator
                steps={STEPS}
                current={step}
                label="Reschedule steps"
                labels="all"
                doneTone="success"
            />
            {message ? (
                <p
                    ref={errorField}
                    id="reschedule-error"
                    role="alert"
                    tabIndex={-1}
                    className="text-sm text-destructive outline-none"
                >
                    {message}
                </p>
            ) : null}
            {network ? (
                <Alert role="alert" className={ALERT_TONES.warning}>
                    <AlertTitle>We could not reach the shop</AlertTitle>
                    <AlertDescription>
                        Your booking was not changed. Try confirming again.
                    </AlertDescription>
                </Alert>
            ) : null}

            {step === 'select' ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <div className="grid gap-1">
                        <h3
                            ref={stepHeading}
                            tabIndex={-1}
                            className="text-lg font-semibold outline-none"
                        >
                            Choose a new time
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Select an exact start time. All times are Philippine
                            time.
                        </p>
                    </div>
                    {dates ? (
                        <ExactStartTimeSelector
                            dates={dates}
                            selectedDate={picker.date}
                            onDateChange={picker.changeDate}
                            status={picker.status}
                            availability={shown}
                            selectedStart={chosen}
                            onSelect={select}
                            nextAvailable={next ?? null}
                            nextKnown={next !== undefined}
                            onNextAvailable={picker.jumpToNext}
                            onRetry={picker.retry}
                            timezone={timezone}
                            phone={phone}
                        />
                    ) : null}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <InfoIcon aria-hidden="true" className="size-3.5" />
                        Times shown can change until your booking is updated.
                    </p>
                    {picker.lost ? (
                        <p role="status" className="text-sm text-destructive">
                            The time you chose is no longer available. Choose
                            another.
                        </p>
                    ) : null}
                    {nudge && !chosen ? (
                        <p role="status" className="text-sm text-destructive">
                            Choose a start time first.
                        </p>
                    ) : null}
                    <span id="review-hint" className="sr-only">
                        Choose a start time first.
                    </span>
                    <BookingActionBar
                        label="Reschedule actions"
                        inline
                        back={{ onClick: onLeave, label: 'Back' }}
                    >
                        <button
                            type="button"
                            aria-disabled={!chosen || undefined}
                            aria-describedby={
                                chosen ? undefined : 'review-hint'
                            }
                            onClick={review}
                            className={cn(
                                buttonVariants(),
                                !chosen && 'opacity-50',
                            )}
                        >
                            Review new time
                        </button>
                    </BookingActionBar>
                </div>
            ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <div className="grid gap-1">
                        <h3
                            ref={stepHeading}
                            tabIndex={-1}
                            className="text-lg font-semibold outline-none"
                        >
                            Review your new appointment
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Double-check the replacement date and time before
                            confirming.
                        </p>
                    </div>
                    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                        <div className="grid gap-1 rounded-xl border bg-secondary/40 p-4">
                            <p className="text-xs tracking-wide text-foreground/80 uppercase">
                                Current appointment
                            </p>
                            <p className="text-lg font-semibold tabular-nums">
                                {formatDayAndTime(startAt, timezone)}
                            </p>
                            <p className="text-sm text-foreground/80">
                                Confirmed and still reserved
                            </p>
                        </div>
                        <ArrowRightIcon
                            aria-hidden="true"
                            className="mx-auto size-5 rotate-90 text-primary sm:rotate-0"
                        />
                        <div className="grid gap-1 rounded-xl border border-primary bg-primary/5 p-4">
                            <p className="text-xs tracking-wide text-foreground/80 uppercase">
                                Requested replacement
                            </p>
                            <p className="text-lg font-semibold tabular-nums">
                                {chosen
                                    ? formatDayAndTime(chosen, timezone)
                                    : ''}
                            </p>
                            <p className="text-sm text-foreground/80">
                                Philippine time
                            </p>
                        </div>
                    </div>
                    <DetailRows rows={summaryRows} />
                    <Alert role={undefined} className={ALERT_TONES.info}>
                        <InfoIcon aria-hidden="true" />
                        <AlertTitle>Your current time is protected</AlertTitle>
                        <AlertDescription>
                            We will check the replacement time before moving
                            your booking. If it is unavailable, your original
                            booking is unchanged.
                        </AlertDescription>
                    </Alert>
                    {picker.online ? null : (
                        <Alert role="alert" className={ALERT_TONES.warning}>
                            <AlertTitle>You appear to be offline</AlertTitle>
                            <AlertDescription>
                                Nothing was changed. Reconnect, then confirm.
                            </AlertDescription>
                        </Alert>
                    )}
                    <BookingActionBar
                        label="Reschedule actions"
                        inline
                        back={{
                            onClick: () => onStep('select'),
                            label: 'Back',
                        }}
                    >
                        <button
                            type="button"
                            aria-disabled={
                                form.processing || !picker.online || undefined
                            }
                            onClick={confirm}
                            className={cn(
                                buttonVariants(),
                                (form.processing || !picker.online) &&
                                    'pointer-events-none opacity-50',
                            )}
                        >
                            {form.processing
                                ? 'Rescheduling…'
                                : 'Confirm new time'}
                        </button>
                    </BookingActionBar>
                </div>
            )}
        </section>
    );
}
