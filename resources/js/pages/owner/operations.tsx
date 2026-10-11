import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CircleAlertIcon,
} from 'lucide-react';
import { useState } from 'react';
import { AttentionPanel } from '@/components/operations/attention-panel';
import { BlocksPanel } from '@/components/operations/blocks-panel';
import { CapacityPanel } from '@/components/operations/capacity-panel';
import { ListPagination } from '@/components/operations/list-pagination';
import { MoreDestinations } from '@/components/operations/more-destinations';
import {
    OperationQueueRow,
    QUEUE_COLUMNS,
} from '@/components/operations/operation-queue-row';
import { OperationStatCard } from '@/components/operations/operation-stat-card';
import { OperationsBanners } from '@/components/operations/operations-banners';
import { OperationsLockContext } from '@/components/operations/operations-lock';
import { WalkInSheet } from '@/components/operations/walk-in-sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOperationsLive } from '@/hooks/use-operations-live';
import { formatLocalDate } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';
import type {
    OperationsPageData,
    OperationsView,
    QueueFilter,
    QueueRowData,
} from '@/types/operations';

type Props = OwnerPageProps & OperationsPageData;

/** Errors that describe a rejected action or request; a stale revision is shown on its own. */
const ERROR_KEYS = [
    'booking',
    'resource_id',
    'before',
    'reason',
    'confirm',
    'notification',
    'idempotency_key',
    'date',
    'view',
    'filter',
    'queue_page',
    'blocks_page',
    'failures_page',
];

type ListState = {
    date: string;
    view: OperationsView;
    filter: QueueFilter;
    queue_page: number;
    blocks_page: number;
    failures_page: number;
};

const VIEW_TITLES: Record<OperationsView, string> = {
    dashboard: 'Dashboard',
    queue: 'Queue',
    bookings: 'Bookings',
    'walk-in': 'Add walk-in',
    more: 'More',
};

const FILTERS: { value: QueueFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'checked_in', label: 'Checked in' },
    { value: 'in_service', label: 'In service' },
    { value: 'booked', label: 'Booked' },
];

/**
 * Staff operations workspace (Spec 04 references 01-17). Desktop is one
 * consolidated page; on phones the same page is split into URL-backed focused
 * views (Dashboard, Queue, Bookings, Walk-in, More) that are only CSS-hidden
 * sections of one domain, never separate pages. The queue is the primary
 * task: each row has its one routine next action, counters, capacity,
 * attention and blocks stay secondary. Everything shown is server truth for one
 * operating day; actions are re-validated by the server, a stale revision is
 * reported with a way to refresh, the lists are paged so nothing is hidden, a
 * private-channel nudge refreshes the board, and every transaction is disabled
 * while offline.
 */
export default function Operations({
    organization,
    viewer,
    day,
    now,
    stats,
    view,
    filter,
    pages,
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
    const live = useOperationsLive(organization.id);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const errors = props.errors ?? {};
    const message = ERROR_KEYS.map((key) => errors[key]).find(Boolean) ?? null;
    const queued = queue.filter((row) => row.actions.reorder);
    const state: ListState = {
        date: day.date,
        view,
        filter,
        queue_page: pages.queue.page,
        blocks_page: pages.blocks.page,
        failures_page: pages.failures.page,
    };
    /** On a phone only the focused views listed are shown; on desktop everything is. */
    const on = (...views: OperationsView[]) =>
        views.includes(view) ? undefined : 'max-lg:hidden';

    function go(next: Partial<ListState>) {
        const merged = { ...state, ...next };
        const query: Record<string, string | number> = {};
        if (merged.date !== day.today) {
            query.date = merged.date;
        }
        if (merged.view !== 'dashboard') {
            query.view = merged.view;
        }
        if (merged.filter !== 'all') {
            query.filter = merged.filter;
        }
        for (const key of [
            'queue_page',
            'blocks_page',
            'failures_page',
        ] as const) {
            if (merged[key] > 1) {
                query[key] = merged[key];
            }
        }
        router.get(urls.operations, query, {
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
    const goDay = (date: string) =>
        go({ date, queue_page: 1, blocks_page: 1, failures_page: 1 });
    const refresh = () => go({});

    const heading =
        view === 'queue'
            ? 'Queue and upcoming'
            : view === 'bookings'
              ? day.isToday
                  ? 'Today’s bookings'
                  : 'Bookings'
              : day.isToday
                ? 'Today’s queue'
                : 'Queue';

    return (
        <OperationsLockContext.Provider value={live.locked}>
            <Head title={`${VIEW_TITLES[view]} - Operations`} />
            <div className="grid gap-6">
                <div
                    className={cn(
                        'flex flex-wrap items-center justify-between gap-3',
                        on('dashboard', 'queue', 'bookings', 'walk-in'),
                    )}
                >
                    <div
                        role="group"
                        aria-label="Operating day"
                        className="flex flex-wrap items-center gap-2"
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            className="max-sm:size-11"
                            aria-label="Previous day"
                            onClick={() => goDay(day.previous)}
                        >
                            <ChevronLeftIcon aria-hidden="true" />
                        </Button>
                        <p className="text-center font-semibold tabular-nums lg:min-w-32">
                            {day.isToday ? 'Today, ' : ''}
                            {formatLocalDate(day.date)}
                        </p>
                        <Button
                            variant="outline"
                            size="icon"
                            className="max-sm:size-11"
                            aria-label="Next day"
                            onClick={() => goDay(day.next)}
                        >
                            <ChevronRightIcon aria-hidden="true" />
                        </Button>
                        {day.isToday ? null : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="max-sm:h-11"
                                onClick={() => goDay(day.today)}
                            >
                                Back to today
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="max-lg:hidden"
                            aria-busy={loading || live.refresh === 'refreshing'}
                            onClick={refresh}
                        >
                            Refresh
                        </Button>
                    </div>
                    <WalkInSheet
                        key={view === 'walk-in' ? 'walk-in-open' : 'walk-in'}
                        initiallyOpen={view === 'walk-in'}
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

                <OperationsBanners
                    online={live.online}
                    recovering={live.online && live.locked}
                    livePaused={live.link === 'disconnected'}
                    refreshFailed={failed || live.refresh === 'failed'}
                    stale={errors.revision ?? null}
                    message={message}
                    onRefresh={refresh}
                />

                {stats.delayed > 0 ? (
                    <Alert
                        className={cn(ALERT_TONES.warning, on('dashboard'))}
                        role="status"
                    >
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>
                                Service overruns remain occupied until staff
                                marks them complete. The cleaning buffer still
                                applies afterward.
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                <ul
                    aria-label="Counts for the day"
                    className={cn(
                        'grid grid-cols-2 gap-3 xl:grid-cols-4',
                        on('dashboard'),
                    )}
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
                            hint="Ready for staff action"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="In service"
                            value={stats.inService}
                            tone="success"
                            hint="Actual timing tracked"
                        />
                    </li>
                    <li>
                        <OperationStatCard
                            label="Completed"
                            value={stats.completed}
                            tone="info"
                            hint={
                                stats.noShow > 0
                                    ? `${stats.noShow} no-show${day.isToday ? ' today' : ''}`
                                    : undefined
                            }
                        />
                    </li>
                </ul>

                <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <section
                        aria-labelledby="queue-heading"
                        className={cn(
                            'grid gap-3',
                            on('dashboard', 'queue', 'bookings', 'walk-in'),
                        )}
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <h2
                                id="queue-heading"
                                className="text-xl font-semibold"
                            >
                                {heading}
                            </h2>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {pages.queue.total}{' '}
                                {pages.queue.total === 1
                                    ? 'booking'
                                    : 'bookings'}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-fit max-sm:h-11 lg:hidden"
                            aria-busy={loading || live.refresh === 'refreshing'}
                            onClick={refresh}
                        >
                            Refresh queue
                        </Button>
                        {view === 'queue' ? (
                            <div
                                role="group"
                                aria-label="Filter the queue"
                                className="flex flex-wrap gap-x-5 border-b"
                            >
                                {FILTERS.map((item) => {
                                    const count =
                                        item.value === 'all'
                                            ? stats.appointments
                                            : item.value === 'checked_in'
                                              ? stats.checkedIn
                                              : item.value === 'in_service'
                                                ? stats.inService
                                                : stats.waiting;

                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            aria-pressed={filter === item.value}
                                            onClick={() =>
                                                go({
                                                    filter: item.value,
                                                    queue_page: 1,
                                                })
                                            }
                                            className={cn(
                                                '-mb-px min-h-11 border-b-2 px-1 text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                                                filter === item.value
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-muted-foreground',
                                            )}
                                        >
                                            {item.label} ({count})
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                        {loading ? (
                            <QueueSkeleton />
                        ) : queue.length === 0 ? (
                            <Card className="rounded-2xl py-6 shadow-none">
                                <CardContent className="grid gap-1 px-6">
                                    <h3 className="text-lg font-semibold">
                                        {filter !== 'all'
                                            ? 'Nothing matches this filter'
                                            : day.isToday
                                              ? 'Nothing booked today'
                                              : 'Nothing booked this day'}
                                    </h3>
                                    <p className="max-w-[66ch] text-sm text-muted-foreground">
                                        {filter !== 'all'
                                            ? 'Choose All to see every booking for the day.'
                                            : 'Confirmed bookings and walk-ins for the day appear here. Add a walk-in when a customer arrives without a booking.'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="xl:rounded-2xl xl:border xl:bg-card xl:px-5">
                                <div
                                    aria-hidden="true"
                                    className={`hidden border-b py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase xl:grid ${QUEUE_COLUMNS}`}
                                >
                                    <span>Time</span>
                                    <span>Customer / vehicle</span>
                                    <span>Status</span>
                                    <span>Bay</span>
                                    <span>Est. finish</span>
                                    <span>Action</span>
                                </div>
                                <ul
                                    aria-label="Queue"
                                    className="grid gap-3 xl:gap-0"
                                >
                                    {queue.map((row) => (
                                        <OperationQueueRow
                                            key={row.id}
                                            row={row}
                                            now={now}
                                            baseUrl={urls.bookings}
                                            timezone={day.timezone}
                                            resources={resources}
                                            moveBefore={previousQueued(
                                                queued,
                                                row,
                                            )}
                                        />
                                    ))}
                                </ul>
                            </div>
                        )}
                        <ListPagination
                            noun="bookings"
                            info={pages.queue}
                            disabled={loading}
                            onPage={(page) => go({ queue_page: page })}
                        />
                    </section>

                    <div className="grid gap-6">
                        <div className={cn(on('dashboard'))}>
                            <CapacityPanel rows={capacity} />
                        </div>
                        <div
                            className={cn(
                                'grid gap-3',
                                on('dashboard', 'more'),
                            )}
                        >
                            <AttentionPanel
                                items={attention}
                                total={pages.failures.total}
                                delayed={stats.delayed}
                                url={urls.failures}
                            />
                            <ListPagination
                                noun="failed emails"
                                info={pages.failures}
                                disabled={loading}
                                onPage={(page) => go({ failures_page: page })}
                            />
                        </div>
                        <div className={cn('grid gap-3', on('dashboard'))}>
                            <BlocksPanel
                                blocks={blocks}
                                total={pages.blocks.total}
                                url={urls.blocks}
                                resources={resources}
                                timezone={day.timezone}
                            />
                            <ListPagination
                                noun="blocks"
                                info={pages.blocks}
                                disabled={loading}
                                onPage={(page) => go({ blocks_page: page })}
                            />
                        </div>
                    </div>
                </div>

                <div className={cn('lg:hidden', on('more'))}>
                    <h2 className="mb-3 text-xl font-semibold">More</h2>
                    <MoreDestinations
                        organization={organization}
                        viewer={viewer}
                    />
                </div>
            </div>
        </OperationsLockContext.Provider>
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
