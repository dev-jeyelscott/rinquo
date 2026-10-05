import { Head, router, usePage } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { ConflictDetail } from '@/components/conflicts/conflict-detail';
import { ConflictQueueRow } from '@/components/conflicts/conflict-queue-row';
import { OperationStatCard } from '@/components/operations/operation-stat-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayAndTime } from '@/lib/booking-format';
import { statusLabel } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import type { ConflictsPageData } from '@/types/conflicts';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & ConflictsPageData;

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
    const errors = props.errors ?? {};
    const message = ERROR_KEYS.map((key) => errors[key]).find(Boolean);
    const selected = [...unresolved, ...recent].find(
        (row) => row.id === selectedId,
    );

    function open(id: string | null) {
        router.get(urls.conflicts, id === null ? {} : { conflict: id }, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => {
                setLoading(true);
                setFailed(false);
            },
            onError: () => setFailed(true),
            onNetworkError: () => setFailed(true),
            onFinish: () => setLoading(false),
        });
    }

    return (
        <>
            <Head title="Scheduling conflicts" />
            <div className="grid gap-6">
                <ul
                    aria-label="Conflict counts"
                    className="grid gap-3 sm:grid-cols-3"
                >
                    <li>
                        <OperationStatCard
                            label="Needs proposal"
                            value={counts.needsProposal}
                            tone="warning"
                            hint="Staff action required"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Awaiting reply"
                            value={counts.awaitingCustomer}
                            tone="info"
                            hint="Proposal sent to customer"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Moved at the same time"
                            value={counts.reassigned}
                            tone="success"
                            hint="Last 14 days, no action needed"
                        />
                    </li>
                </ul>

                {message ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>{message}</p>
                            {errors.revision || errors.proposal ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 max-sm:h-11"
                                    onClick={() => open(selectedId)}
                                >
                                    Refresh the conflict
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
                                        />
                                    ))}
                                </ul>
                            )}
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
                        </section>
                    </div>

                    <section
                        aria-labelledby="resolution-heading"
                        className="grid gap-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2
                                id="resolution-heading"
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
