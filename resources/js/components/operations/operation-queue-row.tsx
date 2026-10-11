import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { AssignResourceSheet } from '@/components/operations/assign-resource-sheet';
import { BookingDetailsSheet } from '@/components/operations/booking-details-sheet';
import { OPERATION_STATE } from '@/components/operations/operation-state';
import { useOperationsLocked } from '@/components/operations/operations-lock';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useOperationKey } from '@/hooks/use-operation-key';
import { formatTime } from '@/lib/booking-format';
import type { QueueRowData, ResourceOption } from '@/types/operations';

/** Desktop table columns: time, customer and vehicle, status, bay, estimated finish, action. */
export const QUEUE_COLUMNS =
    'xl:grid-cols-[5.5rem_minmax(0,1fr)_7.5rem_7rem_5rem_7.5rem] xl:gap-x-3';

type Props = {
    row: QueueRowData;
    /** Base of the booking operation endpoints. */
    baseUrl: string;
    timezone: string;
    resources: ResourceOption[];
    /** The queued row directly above this one, when "Move up" makes sense. */
    moveBefore: QueueRowData | null;
    /** The server's current instant, to say whether a booking is inside its grace period. */
    now: string;
};

export type PrimaryAction = {
    path: string;
    label: string;
    detailLabel: string;
    busy: string;
};

export function primaryAction(row: QueueRowData): PrimaryAction | null {
    if (row.actions.checkIn) {
        return {
            path: 'check-in',
            label: 'Check in',
            detailLabel: 'Check in',
            busy: 'Checking in…',
        };
    }
    if (row.actions.start) {
        return {
            path: 'start',
            label: 'Start',
            detailLabel: 'Start service',
            busy: 'Starting…',
        };
    }
    if (row.actions.complete) {
        return {
            path: 'complete',
            label: 'Complete',
            detailLabel: 'Complete service',
            busy: 'Completing…',
        };
    }

    return null;
}

/**
 * One queue entry (Spec 04 references 01 and 02). Desktop lays the booking out
 * as a table row (time, customer and vehicle, status, bay, estimated finish,
 * action); phones show the same facts as a card. The customer name opens a
 * read-only contextual details sheet that holds the secondary actions
 * (assignment, move up, early buffer release, no-show). The row itself carries
 * only the one routine next action. The server decides which actions exist and
 * re-validates every one, so this row only presents them, and every
 * transaction is disabled while the board is offline.
 */
export function OperationQueueRow({
    row,
    baseUrl,
    timezone,
    resources,
    moveBefore,
    now,
}: Props) {
    const locked = useOperationsLocked();
    const [pending, setPending] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const item = useRef<HTMLLIElement>(null);
    const refocus = useRef(false);
    const primary = primaryAction(row);
    const state = OPERATION_STATE[row.state];
    const url = (path: string) => `${baseUrl}/${row.id}/${path}`;
    // A fresh key per revision: a retried click replays, a changed booking never reuses it.
    const issueKey = useOperationKey(`${row.revision}:${row.state}`);
    const data = () => ({
        revision: row.revision,
        idempotency_key: issueKey(),
    });
    const inGrace =
        row.state === 'scheduled' &&
        !row.actions.noShow &&
        new Date(now).getTime() >= new Date(row.startAt).getTime();

    // The pressed control is disabled while the request runs, which drops focus
    // to the document. Once it settles, return to the row's next action, or to
    // its details control when no action remains, so keyboard users keep their place.
    useEffect(() => {
        if (pending || !refocus.current) {
            return;
        }
        refocus.current = false;
        const next =
            item.current?.querySelector<HTMLElement>(
                '[data-row-primary]:not(:disabled)',
            ) ?? item.current?.querySelector<HTMLElement>('[data-row-details]');
        next?.focus();
    }, [pending]);

    function runPrimary(fromRow = false) {
        if (primary === null || pending) {
            return;
        }
        refocus.current = fromRow;
        router.post(url(primary.path), data(), {
            preserveScroll: true,
            onStart: () => setPending(true),
            // Settled either way: a rejection (stale revision, no safe bay) is shown on the page, not behind a sheet.
            onFinish: () => {
                setPending(false);
                setDetailsOpen(false);
            },
        });
    }

    return (
        <li
            ref={item}
            className="max-xl:rounded-2xl max-xl:border max-xl:bg-card xl:border-b xl:last:border-b-0"
        >
            <div
                className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 xl:px-0 ${QUEUE_COLUMNS}`}
            >
                <p className="text-lg font-semibold whitespace-nowrap tabular-nums max-xl:order-1">
                    {formatTime(row.startAt, timezone)}
                </p>
                <div className="grid gap-0.5 max-xl:order-3 max-xl:col-span-2">
                    <BookingDetailsSheet
                        row={row}
                        baseUrl={baseUrl}
                        timezone={timezone}
                        moveBefore={moveBefore}
                        now={now}
                        open={detailsOpen}
                        onOpenChange={setDetailsOpen}
                        data={data}
                        onAssign={() => {
                            setDetailsOpen(false);
                            setAssignOpen(true);
                        }}
                        primary={
                            primary
                                ? {
                                      label: primary.detailLabel,
                                      busy: primary.busy,
                                      pending,
                                      onRun: () => runPrimary(),
                                  }
                                : null
                        }
                    />
                    {row.actions.assign ? (
                        <AssignResourceSheet
                            row={row}
                            url={url('assign')}
                            resources={resources}
                            open={assignOpen}
                            onOpenChange={setAssignOpen}
                        />
                    ) : null}
                    {row.source === 'walk_in' ? (
                        <span className="w-fit">
                            <StatusChip tone="info">Walk-in</StatusChip>
                        </span>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                        {[
                            row.vehicleName +
                                (row.vehiclePlate
                                    ? ` (${row.vehiclePlate})`
                                    : ''),
                            row.serviceName,
                            ...row.addOns,
                        ].join(' · ')}
                    </p>
                    {row.lateArrivalAt ? (
                        <p className="text-xs font-semibold text-warning-text tabular-nums">
                            Late arrival at{' '}
                            {formatTime(row.lateArrivalAt, timezone)}
                        </p>
                    ) : null}
                    {inGrace ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                            In grace period until{' '}
                            {formatTime(row.noShowEligibleAt, timezone)}
                        </p>
                    ) : null}
                    {row.delayMinutes > 0 ? (
                        <p className="text-xs font-semibold text-warning-text tabular-nums">
                            Running {row.delayMinutes} min late
                        </p>
                    ) : null}
                </div>
                <div className="justify-self-end max-xl:order-2 xl:justify-self-start">
                    <StatusChip tone={state.tone}>{state.label}</StatusChip>
                </div>
                <p className="text-sm max-xl:order-4 max-xl:text-muted-foreground">
                    <span className="sr-only">Bay: </span>
                    <span className="tabular-nums">{row.resource.name}</span>
                    {row.etaAt ? (
                        <span className="tabular-nums xl:hidden">
                            {' · '}finishes {formatTime(row.etaAt, timezone)}
                        </span>
                    ) : null}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums max-xl:hidden">
                    <span className="sr-only">Estimated finish: </span>
                    {row.etaAt ? formatTime(row.etaAt, timezone) : '—'}
                </p>
                <div className="justify-self-end max-xl:order-5">
                    {primary ? (
                        <Button
                            type="button"
                            data-row-primary
                            aria-label={`${primary.label} ${row.customerName}`}
                            className="min-w-[7rem] max-sm:h-11"
                            disabled={pending || locked}
                            aria-busy={pending}
                            onClick={() => runPrimary(true)}
                        >
                            {pending ? (
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {pending ? primary.busy : primary.label}
                        </Button>
                    ) : null}
                </div>
            </div>
        </li>
    );
}
