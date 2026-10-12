import { Head, router, usePage } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConflictDetail } from '@/components/conflicts/conflict-detail';
import { ConflictQueueRow } from '@/components/conflicts/conflict-queue-row';
import { OperationStatCard } from '@/components/operations/operation-stat-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { useOnline } from '@/hooks/use-online';
import { formatDayAndTime } from '@/lib/booking-format';
import { statusLabel } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import type { ConflictsPageData } from '@/types/conflicts';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & ConflictsPageData;

/** Server rejections that mean what the page shows is out of date: nothing may be re-sent until it is refreshed. */
const STALE_KEYS = ['revision', 'proposal', 'start_at'];

const ERROR_KEYS = [
    'start_at',
    'revision',
    'conflict',
    'proposal',
    'idempotency_key',
];

/**
 * Scheduling-conflict dashboard (reference screen 04). The queue lists what
 * still needs a decision, soonest appointment first; the right pane is the
 * resolution workspace for the selected conflict, with the protected original
 * appointment beside any proposal. Recently resolved conflicts, including
 * automatic same-time moves, stay below as evidence. Everything shown is server
 * truth; mutations are re-validated and a stale revision is explained with a
 * way to refresh instead of being applied.
 */
export default function SchedulingConflicts({
    organization,
    timezone,
    counts,
    unresolved,
    recent,
    selectedId,
    candidates,
    urls,
}: Props) {
    const { props } = usePage<{ errors?: Record<string, string> }>();
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const online = useOnline();
    const now = useNow(30000);
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const [wasOnline, setWasOnline] = useState(online);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const errors = props.errors ?? {};
    const message = ERROR_KEYS.map((key) => errors[key]).find(Boolean);
    const selected = [...unresolved, ...recent].find(
        (row) => row.id === selectedId,
    );

    // Losing the connection means what is on screen can no longer be vouched for.
    if (online !== wasOnline) {
        setWasOnline(online);

        if (!online) {
            setNeedsRefresh(true);
        }
    }

    const stale = STALE_KEYS.some((key) => Boolean(errors[key]));
    const locked = !online || needsRefresh || loading || failed || stale;
    const truncated =
        unresolved.length > 0 &&
        organization.unresolvedConflicts > unresolved.length;

    // A successful send or withdraw replaces the conflict's revision and remounts the detail pane;
    // keep keyboard users in the resolution panel instead of at the document start.
    const revision = selected?.revision;
    const previous = useRef({ id: selectedId, revision });

    useEffect(() => {
        if (
            previous.current.id === selectedId &&
            previous.current.revision !== revision
        ) {
            headingRef.current?.focus();
        }

        previous.current = { id: selectedId, revision };
    }, [selectedId, revision]);

    function open(id: string | null) {
        router.get(urls.conflicts, id === null ? {} : { conflict: id }, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => {
                setLoading(true);
                setFailed(false);
            },
            onSuccess: () => {
                setNeedsRefresh(false);
                // The control that asked for the refresh may be gone: land on the resolution panel.
                requestAnimationFrame(() => headingRef.current?.focus());
            },
            onError: () => setFailed(true),
            onNetworkError: () => setFailed(true),
            onFinish: () => setLoading(false),
        });
    }

    // Back online: read server truth before any proposal action is offered again.
    useEffect(() => {
        if (online && needsRefresh) {
            open(selectedId);
        }
        // Reconnection is the trigger; later refreshes are user-driven.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online]);

    return (
        <>
            <Head title="Scheduling conflicts" />
            <div className="grid gap-6">
                {!online ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertTitle className="line-clamp-none">
                            Offline: actions paused
                        </AlertTitle>
                        <AlertDescription>
                            <p>
                                Capacity and proposal availability cannot be
                                safely verified. Do not send, replace or
                                withdraw proposals while offline. Nothing is
                                queued.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 max-sm:h-11"
                                onClick={() => open(selectedId)}
                            >
                                Reconnect and refresh
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}
                {message ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>{message}</p>
                            {stale ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 max-sm:h-11"
                                    onClick={() => open(selectedId)}
                                >
                                    {errors.start_at && !errors.revision
                                        ? 'Refresh available times'
                                        : 'Refresh the conflict'}
                                </Button>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : null}
                {failed ? (
                    <Alert className={ALERT_TONES.warning} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>
                                The conflict could not be loaded, so what you
                                see may be out of date.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 max-sm:h-11"
                                onClick={() => open(selectedId)}
                            >
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                <ul
                    aria-label="Conflict counts"
                    className="grid grid-cols-3 gap-2 sm:gap-3"
                >
                    <li>
                        <OperationStatCard
                            label="Needs proposal"
                            value={counts.needsProposal}
                            tone="warning"
                            compact
                            hint="Staff action required"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Awaiting reply"
                            value={counts.awaitingCustomer}
                            tone="info"
                            compact
                            hint="Proposal sent to customer"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Moved at the same time"
                            value={counts.reassigned}
                            tone="success"
                            compact
                            hint="Last 14 days, no action needed"
                        />
                    </li>
                </ul>

                <div className="grid items-start gap-6 xl:grid-cols-[22rem_1fr]">
                    <div className="grid gap-6">
                        <section
                            aria-labelledby="needs-attention-heading"
                            className="grid gap-3"
                        >
                            <h2
                                id="needs-attention-heading"
                                className="text-xl font-semibold"
                            >
                                Needs attention
                            </h2>
                            {unresolved.length === 0 ? (
                                <Card className="rounded-2xl py-6 shadow-none">
                                    <CardContent className="grid gap-1 px-6">
                                        <h3 className="text-lg font-semibold">
                                            No scheduling conflicts
                                        </h3>
                                        <p className="max-w-[66ch] text-sm text-muted-foreground">
                                            When a resource block or a
                                            configuration change leaves a
                                            booking without a safe slot, it
                                            appears here for you to resolve.
                                            Bookings that could stay at the same
                                            time were moved automatically.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <ul
                                    aria-label="Unresolved conflicts"
                                    className="grid gap-2"
                                >
                                    {unresolved.map((row) => (
                                        <ConflictQueueRow
                                            key={row.id}
                                            row={row}
                                            href={`${urls.conflicts}?conflict=${row.id}`}
                                            selected={row.id === selectedId}
                                            timezone={timezone}
                                            now={now}
                                        />
                                    ))}
                                </ul>
                            )}
                            {truncated ? (
                                <p className="text-sm text-muted-foreground tabular-nums">
                                    Showing the {unresolved.length} soonest of{' '}
                                    {organization.unresolvedConflicts}{' '}
                                    unresolved conflicts. Resolve these to see
                                    the rest.
                                </p>
                            ) : null}
                        </section>

                        <section
                            aria-labelledby="resolved-heading"
                            className="grid gap-3"
                        >
                            <h2
                                id="resolved-heading"
                                className="text-xl font-semibold"
                            >
                                Recently resolved
                            </h2>
                            {recent.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nothing was resolved in the last 14 days.
                                </p>
                            ) : (
                                <ul
                                    aria-label="Recently resolved"
                                    className="grid gap-2"
                                >
                                    {recent.map((row) => (
                                        <ConflictQueueRow
                                            key={row.id}
                                            row={row}
                                            href={`${urls.conflicts}?conflict=${row.id}`}
                                            selected={row.id === selectedId}
                                            timezone={timezone}
                                        />
                                    ))}
                                </ul>
                            )}
                            {recent.length >= 20 ? (
                                <p className="text-sm text-muted-foreground">
                                    Showing the {recent.length} most recent
                                    resolutions from the last 14 days.
                                </p>
                            ) : null}
                        </section>
                    </div>

                    <section
                        aria-labelledby="resolution-heading"
                        className="grid gap-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2
                                id="resolution-heading"
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-xl font-semibold"
                            >
                                Resolution
                            </h2>
                            {selected ? (
                                <StatusChip
                                    tone={statusLabel(selected).tone}
                                    caps
                                >
                                    {statusLabel(selected).label}
                                </StatusChip>
                            ) : null}
                        </div>
                        {loading ? (
                            <div
                                aria-busy="true"
                                role="status"
                                className="grid gap-3"
                            >
                                <span className="sr-only">
                                    Loading the conflict
                                </span>
                                <Skeleton className="h-16 rounded-2xl" />
                                <Skeleton className="h-56 rounded-2xl" />
                            </div>
                        ) : selected ? (
                            <ConflictDetail
                                key={`${selected.id}:${selected.revision}`}
                                row={selected}
                                candidates={candidates}
                                timezone={timezone}
                                conflictsUrl={urls.conflicts}
                                operationsUrl={urls.operations}
                                locked={locked}
                            />
                        ) : (
                            <Card className="rounded-2xl py-6 shadow-none">
                                <CardContent className="px-6 text-sm text-muted-foreground">
                                    Select a conflict to review the affected
                                    booking and resolve it.
                                    {recent.length > 0 &&
                                    unresolved.length === 0
                                        ? ` The last change was ${formatDayAndTime(recent[0].detectedAt, timezone)}.`
                                        : ''}
                                </CardContent>
                            </Card>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
