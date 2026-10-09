import { Link } from '@inertiajs/react';
import { TimerIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { formatClock } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';

type Props = {
    /** Whole seconds left, from {@link useCountdown}. */
    remaining: number;
    /** The server says it expired, or the countdown reached zero. */
    expired: boolean;
    /** Where the customer picks another time, with the selection kept. */
    chooseAnotherUrl: string;
};

/**
 * Visible countdown for a checkout hold (the page owns the ticking value so
 * its primary action can change when time runs out). While time remains it is
 * a plain warning-toned timer (not announced every second) that says the
 * selection is temporary; when it reaches zero a single alert explains that
 * the time was released and offers both recoveries. Keeping the time is the
 * page's own primary action, because the server re-validates it then.
 */
export function HoldCountdown({ remaining, expired, chooseAnotherUrl }: Props) {
    if (expired) {
        return (
            <Alert className={ALERT_TONES.warning}>
                <TimerIcon aria-hidden="true" />
                <AlertTitle>Your held time was released</AlertTitle>
                <AlertDescription>
                    <p>
                        Someone else may book it now. Use the button below to
                        try to keep this time, or choose another time.
                    </p>
                    <Link
                        href={chooseAnotherUrl}
                        className={cn(
                            buttonVariants({ variant: 'outline' }),
                            'max-lg:min-h-11',
                        )}
                    >
                        Choose another time
                    </Link>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div
            role="timer"
            className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-sm',
                ALERT_TONES.warning,
            )}
        >
            <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"
            >
                <TimerIcon className="size-5" />
            </span>
            <p className="grid gap-0.5">
                <span className="font-semibold">
                    Time held for{' '}
                    <span className="tabular-nums">
                        {formatClock(remaining, true)}
                    </span>
                </span>
                <span>
                    Finish before this timer runs out. Your selection is
                    temporary.
                </span>
            </p>
        </div>
    );
}

/** The quiet "Time held: 08:43" status shown in the mobile action bar. */
export function HoldCountdownStatus({ remaining }: { remaining: number }) {
    return (
        <span className="inline-flex items-center gap-1">
            <TimerIcon aria-hidden="true" className="size-3.5" />
            Time held: {formatClock(remaining, true)}
        </span>
    );
}
