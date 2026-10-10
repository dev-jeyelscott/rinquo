import { CircleAlertIcon, RadioIcon, WifiOffIcon } from 'lucide-react';
import { useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import type { LiveLink, LiveRefresh } from '@/hooks/use-booking-live';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';

type Props = {
    link: LiveLink;
    refresh: LiveRefresh;
    onRefresh: () => void;
};

/**
 * The live-status line of a booking page. Healthy states are one quiet line;
 * refreshing shows only after 300 ms (loading-state hierarchy); a failed
 * reload or a lost connection becomes an alert that says the page may be out
 * of date and offers the one recovery, a manual refresh.
 *
 * Announcements go through two live regions that stay mounted (a region that
 * is inserted with its content is not reliably announced): a polite one for
 * transitions, silent while the link is simply healthy, and an assertive one
 * for a failed reload. The visible alerts carry no live role, so nothing is
 * announced twice. Activating a recovery control moves focus to the polite
 * region so its outcome is read and focus never falls back to the page start.
 */
export function BookingLiveStatus({ link, refresh, onRefresh }: Props) {
    const slow = useDelayedFlag(refresh === 'refreshing');
    const announcer = useRef<HTMLParagraphElement>(null);
    const failed = refresh === 'failed';
    const paused = link === 'disconnected';
    const recover = () => {
        onRefresh();
        announcer.current?.focus();
    };

    // Priority: a failed reload, a slow refresh, then the link. A lost connection is announced whatever
    // outcome came before (the hook clears a stale "updated" when the link drops); a refresh outcome shown
    // while the link is down says so, so the two never read as the same message.
    const announcement = failed
        ? ''
        : slow
          ? 'Updating booking details.'
          : refresh === 'updated'
            ? paused
                ? 'Booking details updated. Live updates are still paused.'
                : 'Booking details updated.'
            : paused
              ? 'Live updates are paused. Changes made elsewhere will not appear until you refresh.'
              : '';

    let line: string | null = null;
    if (!failed) {
        if (refresh === 'updated') {
            line = paused
                ? 'Updated just now. Live updates are paused.'
                : 'Updated just now. Live updates on.';
        } else if (link === 'connecting') {
            line = 'Connecting to live updates…';
        } else if (link === 'connected') {
            line = 'Live updates on.';
        }
    }

    return (
        <div
            className={cn(
                'flex flex-wrap items-center justify-end gap-2',
                (failed || paused) && 'basis-full',
            )}
        >
            <p
                ref={announcer}
                role="status"
                tabIndex={-1}
                className="sr-only outline-none"
            >
                {announcement}
            </p>
            <div aria-live="assertive" aria-atomic="true" className="sr-only">
                {failed
                    ? 'Could not load the latest booking details. What you see may be out of date.'
                    : ''}
            </div>
            {failed ? (
                <Alert
                    role={undefined}
                    className={cn('basis-full', ALERT_TONES.error)}
                >
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertTitle>
                        We could not load the latest details
                    </AlertTitle>
                    <AlertDescription>
                        <p>What you see may be out of date.</p>
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={recover}
                        >
                            Try again
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : paused ? (
                <Alert
                    role={undefined}
                    className={cn('basis-full', ALERT_TONES.warning)}
                >
                    <WifiOffIcon aria-hidden="true" />
                    <AlertTitle>Live updates are paused</AlertTitle>
                    <AlertDescription>
                        <p>
                            Changes made elsewhere will not appear until you
                            refresh. Your booking is not affected.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={recover}
                        >
                            Refresh now
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {slow ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner
                        role={undefined}
                        aria-hidden="true"
                        className="size-4"
                    />
                    <span>Updating booking…</span>
                </p>
            ) : line ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RadioIcon aria-hidden="true" className="size-3.5" />
                    <span>{line}</span>
                </p>
            ) : null}
        </div>
    );
}
