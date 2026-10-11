import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnline } from '@/hooks/use-online';
import { connectEcho } from '@/lib/echo';

export type LiveLink = 'connecting' | 'connected' | 'disconnected';
export type LiveRefresh = 'idle' | 'refreshing' | 'updated' | 'failed';

const EVENT = '.operations.changed';
/** Props a nudge re-reads; the date, view and filter come from the current URL. */
const ONLY = [
    'now',
    'stats',
    'queue',
    'pages',
    'capacity',
    'blocks',
    'attention',
    'resources',
    'entitlement',
    'organization',
];

function linkOf(state: string): LiveLink {
    if (state === 'connected') {
        return 'connected';
    }

    return state === 'connecting' || state === 'initialized'
        ? 'connecting'
        : 'disconnected';
}

/**
 * Keeps the Operations board honest without ever trusting a push. A private
 * organization-channel nudge (or a reconnect, or the browser coming back
 * online) only triggers a partial Inertia reload of the server-authoritative
 * board for the current date, view, filter and pages; nothing in an event is
 * rendered. Events that arrive mid-refresh coalesce into one follow-up reload,
 * and a reload never starts while the member's own write is in flight (Inertia
 * would cancel it). Transactions stay online-only: `locked` is true while the
 * browser is offline and until the catch-up after reconnecting has settled, and
 * nothing is queued for later.
 */
export function useOperationsLive(organizationId: number) {
    const { url, props } = usePage();
    const realtime = props.realtime;
    const online = useOnline();
    const [link, setLink] = useState<LiveLink>('connecting');
    const [refresh, setRefresh] = useState<LiveRefresh>('idle');
    const [recovering, setRecovering] = useState(false);
    const inFlight = useRef(false);
    const queued = useRef(false);
    const writes = useRef(0);
    const wasOnline = useRef(online);
    const run = useRef<() => void>(() => undefined);

    run.current = () => {
        if (inFlight.current || writes.current > 0) {
            queued.current = true;

            return;
        }
        if (!navigator.onLine) {
            setRefresh('failed');
            setRecovering(false);

            return;
        }

        inFlight.current = true;
        setRefresh('refreshing');
        router.get(
            url,
            {},
            {
                only: ONLY,
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

                        return;
                    }
                    setRecovering(false);
                },
            },
        );
    };

    const reload = useCallback(() => run.current(), []);

    // One catch-up when the browser regains connectivity; writes stay locked until it settles.
    useEffect(() => {
        if (online && !wasOnline.current) {
            setRecovering(true);
            run.current();
        }
        wasOnline.current = online;
    }, [online]);

    // Track the page's own writes so a nudge never interrupts one.
    useEffect(() => {
        const offStart = router.on('start', (event) => {
            if (event.detail.visit.method !== 'get') {
                writes.current += 1;
            }
        });
        const offFinish = router.on('finish', (event) => {
            if (event.detail.visit.method === 'get') {
                return;
            }
            writes.current = Math.max(0, writes.current - 1);
            if (writes.current === 0 && queued.current && !inFlight.current) {
                queued.current = false;
                run.current();
            }
        });

        return () => {
            offStart();
            offFinish();
        };
    }, []);

    useEffect(() => {
        const echo = window.Echo ?? (realtime ? connectEcho(realtime) : null);
        if (!echo) {
            setLink('disconnected');

            return;
        }

        const name = `operations.${organizationId}`;
        const connection = echo.connector.pusher.connection;
        // pusher-js recovers a dropped socket through connecting, so the previous state says
        // nothing: any connect after the first one must catch up exactly once.
        let hasConnected = connection.state === 'connected';
        const lose = () =>
            setRefresh((previous) =>
                previous === 'updated' ? 'idle' : previous,
            );
        const onState = ({ current }: { current: string }) => {
            setLink(linkOf(current));
            if (linkOf(current) === 'disconnected') {
                lose();
            }
            if (current !== 'connected') {
                return;
            }
            if (hasConnected) {
                run.current();
            }
            hasConnected = true;
        };

        setLink(linkOf(connection.state));
        connection.bind('state_change', onState);
        echo.private(name)
            .listen(EVENT, () => run.current())
            .error(() => {
                setLink('disconnected');
                lose();
            });

        return () => {
            connection.unbind('state_change', onState);
            echo.leave(name);
        };
    }, [organizationId, realtime]);

    return {
        link,
        refresh,
        online,
        /** True while offline or until the reconnect catch-up has settled: every transaction is disabled. */
        locked: !online || recovering,
        reload,
    };
}
