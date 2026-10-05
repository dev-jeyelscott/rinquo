import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectEcho } from '@/lib/echo';

export type LiveLink = 'connecting' | 'connected' | 'disconnected';
export type LiveRefresh = 'idle' | 'refreshing' | 'updated' | 'failed';

const EVENT = '.booking.lifecycle.changed';
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

function linkOf(state: string): LiveLink {
    if (state === 'connected') {
        return 'connected';
    }

    return state === 'connecting' || state === 'initialized'
        ? 'connecting'
        : 'disconnected';
}

/**
 * Keeps an open booking page honest. A private-channel event (or reconnecting,
 * or the change deadline passing) only triggers a partial Inertia reload of
 * the server-authoritative booking; nothing in an event is ever rendered.
 * Events that arrive mid-refresh coalesce into a single follow-up reload.
 */
export function useBookingLive(publicId: string, deadlineAt: string | null) {
    const { url, props } = usePage();
    const realtime = props.realtime;
    const [link, setLink] = useState<LiveLink>('connecting');
    const [refresh, setRefresh] = useState<LiveRefresh>('idle');
    const inFlight = useRef(false);
    const queued = useRef(false);
    const run = useRef<() => void>(() => undefined);

    run.current = () => {
        if (inFlight.current) {
            queued.current = true;

            return;
        }
        if (!navigator.onLine) {
            setRefresh('failed');

            return;
        }

        inFlight.current = true;
        setRefresh('refreshing');
        router.get(
            url,
            {},
            {
                only: ['booking', 'urls'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onSuccess: () => setRefresh('updated'),
                onError: () => setRefresh('failed'),
                onNetworkError: () => setRefresh('failed'),
                onHttpException: () => {
                    setRefresh('failed');

                    return false;
                },
                onFinish: () => {
                    inFlight.current = false;
                    if (queued.current) {
                        queued.current = false;
                        run.current();
                    }
                },
            },
        );
    };

    const reload = useCallback(() => run.current(), []);

    useEffect(() => {
        const echo = window.Echo ?? (realtime ? connectEcho(realtime) : null);
        if (!echo) {
            setLink('disconnected');

            return;
        }

        const name = `booking.${publicId}`;
        const connection = echo.connector.pusher.connection;
        // pusher-js recovers a dropped socket through connecting, so the previous
        // state says nothing: any connect after the first one must catch up.
        let hasConnected = connection.state === 'connected';
        const onState = ({ current }: { current: string }) => {
            setLink(linkOf(current));
            if (current !== 'connected') {
                return;
            }
            // Events sent while disconnected were missed: catch up once.
            if (hasConnected) {
                run.current();
            }
            hasConnected = true;
        };

        setLink(linkOf(connection.state));
        connection.bind('state_change', onState);
        echo.private(name)
            .listen(EVENT, () => run.current())
            .error(() => setLink('disconnected'));

        return () => {
            connection.unbind('state_change', onState);
            echo.leave(name);
        };
    }, [publicId, realtime]);

    // The change deadline passes without any server event: reload to restrict.
    useEffect(() => {
        if (!deadlineAt) {
            return;
        }
        const wait = new Date(deadlineAt).getTime() - Date.now();
        if (wait <= 0 || wait > MAX_TIMER_MS) {
            return;
        }
        const timer = window.setTimeout(() => run.current(), wait + 1000);

        return () => window.clearTimeout(timer);
    }, [deadlineAt]);

    return { link, refresh, reload };
}
