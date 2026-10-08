import { Head, router, usePage } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { BlockResourceSheet } from '@/components/operations/block-resource-sheet';
import { OperationQueueRow } from '@/components/operations/operation-queue-row';
import { OperationStatCard } from '@/components/operations/operation-stat-card';
import { WalkInSheet } from '@/components/operations/walk-in-sheet';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { formatDayAndTime, formatLocalDate } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import type { OwnerPageProps } from '@/types/owner';
import type {
    AttentionItemData,
    CapacityRowData,
    OperationsPageData,
    QueueRowData,
} from '@/types/operations';

type Props = OwnerPageProps & OperationsPageData;

const ERROR_KEYS = [
    'booking',
    'revision',
    'resource_id',
    'before',
    'reason',
    'confirm',
    'notification',
    'idempotency_key',
    'date',
];

/**
 * Staff operations dashboard (reference screen 03). The queue is the primary
 * task: scheduled work first, each row with its one routine next action, while
 * counters, resource load, blocks and notification failures stay secondary.
 * Everything shown is server truth for one operating day; actions are
 * re-validated by the server, and a stale revision is reported with a way to
 * refresh rather than applied.
 */
export default function Operations({
    day,
    stats,
    queue,
    capacity,
    blocks,
    attention,
    resources,
    catalog,
    urls,
    entitlement,
}: Props) {
    const { props } = usePage<{ errors?: Record<string, string> }>();
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const errors = props.errors ?? {};
    const message = ERROR_KEYS.map((key) => errors[key]).find(Boolean);
    const queued = queue.filter((row) => row.actions.reorder);

    function visit(date: string) {
        router.get(urls.operations, date === day.today ? {} : { date }, {
            preserveScroll: true,
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
            <Head title="Operations" />
            <div className="grid gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                        role="group"
                        aria-label="Operating day"
                        className="flex flex-wrap items-center gap-2"
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="max-sm:h-11"
                            onClick={() => visit(day.previous)}
                        >
                            Previous day
                        </Button>
                        <p className="min-w-32 text-center font-semibold tabular-nums">
                            {day.isToday ? 'Today, ' : ''}
                            {formatLocalDate(day.date)}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="max-sm:h-11"
                            onClick={() => visit(day.next)}
                        >
                            Next day
                        </Button>
                        {day.isToday ? null : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="max-sm:h-11"
                                onClick={() => visit(day.today)}
                            >
                                Back to today
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="max-sm:h-11"
                            onClick={() => visit(day.date)}
                        >
                            Refresh
                        </Button>
                    </div>
                    <div id="walk-in" className="scroll-mt-4">
                        <WalkInSheet
                            url={urls.create}
                            catalog={catalog}
                            timezone={day.timezone}
                            unavailableReason={
                                entitlement.acceptsNewBookings
                                    ? null
                                    : 'New walk-ins and bookings are paused. Existing bookings can still be worked.'
                            }
                        />
                    </div>
                </div>

                {message ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>{message}</p>
                            {errors.revision ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 max-sm:h-11"
                                    onClick={() => visit(day.date)}
                                >
                                    Refresh the queue
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
                                The queue could not be refreshed, so it may be
                                out of date.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 max-sm:h-11"
                                onClick={() => visit(day.date)}
                            >
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                <ul
                    aria-label="Counts for the day"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <li>
                        <OperationStatCard
                            label="Appointments"
                            value={stats.appointments}
                            tone="info"
                            hint={`${stats.waiting} not arrived`}
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Checked in"
                            value={stats.checkedIn}
                            tone="warning"
                            hint="Waiting to start"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="In service"
                            value={stats.inService}
                            tone="success"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Completed"
                            value={stats.completed}
                            hint={
                                stats.noShow > 0
                                    ? `${stats.noShow} no-show`
                                    : undefined
                            }
                        />
                    </li>
                </ul>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
                    <section
                        aria-labelledby="queue-heading"
                        className="grid gap-3"
                    >
                        <h2
                            id="queue-heading"
                            className="text-xl font-semibold"
                        >
                            Queue
                        </h2>
                        {loading ? (
                            <QueueSkeleton />
                        ) : queue.length === 0 ? (
                            <Card className="rounded-2xl py-6 shadow-none">
                                <CardContent className="grid gap-1 px-6">
                                    <h3 className="text-lg font-semibold">
                                        {day.isToday
                                            ? 'Nothing booked today'
                                            : 'Nothing booked this day'}
                                    </h3>
                                    <p className="max-w-[66ch] text-sm text-muted-foreground">
                                        Confirmed bookings and walk-ins for the
                                        day appear here. Add a walk-in when a
                                        customer arrives without a booking.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <ul aria-label="Queue" className="grid gap-3">
                                {queue.map((row) => (
                                    <OperationQueueRow
                                        key={row.id}
                                        row={row}
                                        baseUrl={urls.bookings}
                                        timezone={day.timezone}
                                        resources={resources}
                                        moveBefore={previousQueued(queued, row)}
                                    />
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="grid gap-6">
                        <CapacityPanel rows={capacity} />
                        <AttentionPanel items={attention} url={urls.failures} />
                        <BlocksPanel
                            blocks={blocks}
                            url={urls.blocks}
                            resources={resources}
                            timezone={day.timezone}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

function previousQueued(queued: QueueRowData[], row: QueueRowData) {
    const index = queued.findIndex((candidate) => candidate.id === row.id);

    return index > 0 ? queued[index - 1] : null;
}

function QueueSkeleton() {
    return (
        <div aria-busy="true" role="status" className="grid gap-3">
            <span className="sr-only">Loading the queue</span>
            {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
        </div>
    );
}

function CapacityPanel({ rows }: { rows: CapacityRowData[] }) {
    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-4 px-5">
                <h2 className="text-xl font-semibold">Capacity now</h2>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No active resources. Add one in Settings.
                    </p>
                ) : (
                    <ul aria-label="Capacity now" className="grid gap-3">
                        {rows.map((row) => {
                            const full =
                                row.blocked || row.used >= row.capacity;

                            return (
                                <li key={row.id} className="grid gap-1">
                                    <p className="flex items-baseline justify-between gap-2 font-semibold">
                                        <span>{row.name}</span>
                                        <span
                                            className={
                                                full
                                                    ? 'text-destructive tabular-nums'
                                                    : 'text-success tabular-nums'
                                            }
                                        >
                                            {row.blocked
                                                ? 'Blocked'
                                                : `${row.used} / ${row.capacity}${full ? ' full' : ''}`}
                                        </span>
                                    </p>
                                    <div
                                        aria-hidden="true"
                                        className="h-2 overflow-hidden rounded-full bg-secondary"
                                    >
                                        <div
                                            className={
                                                full
                                                    ? 'h-full bg-destructive'
                                                    : 'h-full bg-success'
                                            }
                                            style={{
                                                width: `${row.blocked ? 100 : Math.min(100, (row.used / row.capacity) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function AttentionPanel({
    items,
    url,
}: {
    items: AttentionItemData[];
    url: string;
}) {
    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-3 px-5">
                <h2 className="text-xl font-semibold">Attention</h2>
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No failed emails. Bookings and walk-ins are unaffected
                        either way.
                    </p>
                ) : (
                    <ul
                        aria-label="Failed notifications"
                        className="grid gap-2"
                    >
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="grid gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3"
                            >
                                <p className="font-semibold">
                                    Email delivery failed
                                </p>
                                <p className="text-sm">
                                    {item.label} for {item.customerName}. The
                                    booking itself is saved.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusChip tone="warning">
                                        {item.status === 'retrying'
                                            ? 'Retrying'
                                            : 'Failed'}
                                    </StatusChip>
                                    {item.retryCount > 0 ? (
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {item.retryCount} retry
                                        </span>
                                    ) : null}
                                    {item.status === 'retrying' ? (
                                        <span
                                            role="status"
                                            className="flex items-center gap-1 text-sm"
                                        >
                                            <Spinner
                                                role="presentation"
                                                aria-hidden="true"
                                            />
                                            Retrying…
                                        </span>
                                    ) : (
                                        <ConfirmAction
                                            label="Retry"
                                            ariaLabel={`Retry the ${item.label} email for ${item.customerName}`}
                                            title={`Retry the ${item.label} email?`}
                                            description={`The email to ${item.customerName} is sent again once. The retry is recorded.`}
                                            confirmLabel="Retry email"
                                            confirmVariant="default"
                                            url={`${url}/${item.id}/retry`}
                                        />
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function BlocksPanel({
    blocks,
    url,
    resources,
    timezone,
}: {
    blocks: OperationsPageData['blocks'];
    url: string;
    resources: OperationsPageData['resources'];
    timezone: string;
}) {
    const [releasing, setReleasing] = useState<string | null>(null);

    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-3 px-5">
                <h2 className="text-xl font-semibold">Blocked resources</h2>
                {blocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing is blocked.
                    </p>
                ) : (
                    <ul aria-label="Blocked resources" className="grid gap-2">
                        {blocks.map((block) => (
                            <li key={block.id} className="grid gap-1 text-sm">
                                <p className="font-semibold">
                                    {block.resourceName}
                                </p>
                                <p className="tabular-nums">
                                    {formatDayAndTime(block.startsAt, timezone)}{' '}
                                    to{' '}
                                    {formatDayAndTime(block.endsAt, timezone)}
                                </p>
                                <p className="text-muted-foreground">
                                    {block.reason}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-fit max-sm:h-11"
                                    aria-label={`Release the block on ${block.resourceName}`}
                                    disabled={releasing === block.id}
                                    aria-busy={releasing === block.id}
                                    onClick={() =>
                                        router.post(
                                            `${url}/${block.id}/release`,
                                            {},
                                            {
                                                preserveScroll: true,
                                                onStart: () =>
                                                    setReleasing(block.id),
                                                onFinish: () =>
                                                    setReleasing(null),
                                            },
                                        )
                                    }
                                >
                                    {releasing === block.id
                                        ? 'Releasing…'
                                        : 'Release block'}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                <BlockResourceSheet
                    url={url}
                    resources={resources}
                    timezone={timezone}
                />
            </CardContent>
        </Card>
    );
}
