import { TimerIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
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
 * its primary action can change when time runs out). It is a plain timer
 * (not announced every second); when it reaches zero a single alert explains
 * that the time was released and offers both recoveries. Keeping the time is
 * the page's own primary action, because the server re-validates it then.
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
                            'max-sm:h-11',
                        )}
                    >
                        Choose another time
                    </Link>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <p
            role="timer"
            className="flex items-center gap-2 text-sm text-muted-foreground"
        >
            <TimerIcon aria-hidden="true" className="size-4" />
            <span>
                Your time is held for{' '}
                <span className="font-semibold text-foreground tabular-nums">
                    {formatClock(remaining)}
                </span>
            </span>
        </p>
    );
}
