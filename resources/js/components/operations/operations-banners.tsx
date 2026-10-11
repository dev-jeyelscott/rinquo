import { CircleAlertIcon, WifiOffIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ALERT_TONES } from '@/lib/tones';

type Props = {
    online: boolean;
    /** The catch-up after reconnecting has not settled yet. */
    recovering: boolean;
    /** Realtime is not connected while the browser is online. */
    livePaused: boolean;
    /** The last refresh (manual, day change or live) failed. */
    refreshFailed: boolean;
    /** Stale-revision message from the server, when a write was rejected. */
    stale: string | null;
    /** Any other server message for the last action. */
    message: string | null;
    onRefresh: () => void;
};

/**
 * The distinct board conditions (Spec 04 reference 16), each stating what
 * happened, what still works and what to do. Offline is persistent and
 * announced; stale (another member changed the booking) is a server conflict,
 * not a connectivity problem; a failed refresh says the data may be out of
 * date. Nothing here claims a queued or saved change: transactions are
 * online-only.
 */
export function OperationsBanners({
    online,
    recovering,
    livePaused,
    refreshFailed,
    stale,
    message,
    onRefresh,
}: Props) {
    return (
        <div className="grid gap-3 empty:hidden">
            {online ? null : (
                <Alert className={ALERT_TONES.error} role="alert">
                    <WifiOffIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>
                            <strong>Connection lost.</strong> Actions require
                            internet. Changes are disabled while offline. The
                            queue below was last loaded before the connection
                            dropped. Reconnect and refresh.
                        </p>
                    </AlertDescription>
                </Alert>
            )}
            {online && recovering ? (
                <Alert className={ALERT_TONES.info} role="status">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>
                            <strong>Back online.</strong> Catching up with the
                            latest queue. Actions are available again once it is
                            up to date.
                        </p>
                    </AlertDescription>
                </Alert>
            ) : null}
            {online && !recovering && livePaused ? (
                <Alert className={ALERT_TONES.warning} role="status">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>
                            <strong>Live updates are paused.</strong> The queue
                            catches up when the connection returns. You can
                            refresh it at any time.
                        </p>
                    </AlertDescription>
                </Alert>
            ) : null}
            {stale ? (
                <Alert className={ALERT_TONES.warning} role="alert">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>
                            <strong>Queue may have changed.</strong> {stale}{' '}
                            Refresh before trying again.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 max-sm:h-11"
                            onClick={onRefresh}
                        >
                            Refresh the queue
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {message ? (
                <Alert className={ALERT_TONES.error} role="alert">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>{message}</p>
                    </AlertDescription>
                </Alert>
            ) : null}
            {refreshFailed && online ? (
                <Alert className={ALERT_TONES.warning} role="alert">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        <p>
                            The queue could not be refreshed, so it may be out
                            of date.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 max-sm:h-11"
                            onClick={onRefresh}
                        >
                            Try again
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}
