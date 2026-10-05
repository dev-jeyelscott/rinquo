import { router } from '@inertiajs/react';
import { useState } from 'react';
import { AssignResourceSheet } from '@/components/operations/assign-resource-sheet';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useOperationKey } from '@/hooks/use-operation-key';
import { formatTime } from '@/lib/booking-format';
import type {
    OperationalState,
    QueueRowData,
    ResourceOption,
} from '@/types/operations';

const STATE: Record<
    OperationalState,
    { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }
> = {
    scheduled: { label: 'Booked', tone: 'neutral' },
    checked_in: { label: 'Checked in', tone: 'info' },
    in_service: { label: 'In service', tone: 'success' },
    completed: { label: 'Completed', tone: 'neutral' },
    no_show: { label: 'No-show', tone: 'warning' },
};

type Props = {
    row: QueueRowData;
    /** Base of the booking operation endpoints. */
    baseUrl: string;
    timezone: string;
    resources: ResourceOption[];
    /** The queued row directly above this one, when "Move up" makes sense. */
    moveBefore: QueueRowData | null;
};

type Primary = { path: string; label: string; busy: string };

function primaryAction(row: QueueRowData): Primary | null {
    if (row.actions.checkIn) {
        return { path: 'check-in', label: 'Check in', busy: 'Checking in…' };
    }
    if (row.actions.start) {
        return { path: 'start', label: 'Start', busy: 'Starting…' };
    }
    if (row.actions.complete) {
        return { path: 'complete', label: 'Complete', busy: 'Completing…' };
    }

    return null;
}

/**
 * One queue entry (reference screen 03): time, customer and vehicle, a status
 * chip with its text label, the assigned resource and ETA, and the one routine
 * next action. Consequential choices (no-show, early buffer release, moving up
 * the queue) go through a confirmation dialog with a reason; assignment opens a
 * contextual sheet. The server decides which actions exist and re-validates
 * every one, so this row only presents them.
 */
export function OperationQueueRow({
    row,
    baseUrl,
    timezone,
    resources,
    moveBefore,
}: Props) {
    const [pending, setPending] = useState(false);
    const primary = primaryAction(row);
    const state = STATE[row.state];
    const url = (path: string) => `${baseUrl}/${row.id}/${path}`;
    // A fresh key per revision: a retried click replays, a changed booking never reuses it.
    const issueKey = useOperationKey(`${row.revision}:${row.state}`);
    const data = () => ({
        revision: row.revision,
        idempotency_key: issueKey(),
    });
    const queued = row.actions.assign;

    return (
        <li>
            <Card className="rounded-2xl py-4 shadow-none">
                <CardContent className="grid gap-3 px-4 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center">
                    <p className="text-lg font-semibold tabular-nums">
                        {formatTime(row.startAt, timezone)}
                    </p>
                    <div className="grid gap-1">
                        <h3 className="text-base font-semibold">
                            {row.customerName}
                            {row.source === 'walk_in' ? (
                                <StatusChip className="ml-2" tone="info">
                                    Walk-in
                                </StatusChip>
                            ) : null}
                        </h3>
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
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <StatusChip tone={state.tone}>
                                {state.label}
                            </StatusChip>
                            <span className="tabular-nums">
                                {row.resource.name}
                            </span>
                            {row.etaAt ? (
                                <span className="tabular-nums">
                                    Expected finish{' '}
                                    {formatTime(row.etaAt, timezone)}
                                </span>
                            ) : null}
                            {row.delayMinutes > 0 ? (
                                <span className="font-semibold text-warning tabular-nums">
                                    Running {row.delayMinutes} min late
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {primary ? (
                            <Button
                                type="button"
                                aria-label={`${primary.label} ${row.customerName}`}
                                className="max-sm:h-11"
                                disabled={pending}
                                aria-busy={pending}
                                onClick={() =>
                                    router.post(url(primary.path), data(), {
                                        preserveScroll: true,
                                        onStart: () => setPending(true),
                                        onFinish: () => setPending(false),
                                    })
                                }
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
                    {queued || row.actions.complete || row.actions.noShow ? (
                        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                            {queued ? (
                                <AssignResourceSheet
                                    row={row}
                                    url={url('assign')}
                                    resources={resources}
                                />
                            ) : null}
                            {row.actions.reorder && moveBefore ? (
                                <ConfirmAction
                                    label="Move up"
                                    ariaLabel={`Move ${row.customerName} ahead of ${moveBefore.customerName}`}
                                    title={`Move ${row.customerName} ahead of ${moveBefore.customerName}?`}
                                    description="Only the order of work changes. Appointment times and capacity stay as booked."
                                    confirmLabel="Move up"
                                    confirmVariant="default"
                                    reasonLabel="Reason (kept in the audit log)"
                                    reasonRequired
                                    url={url('reorder')}
                                    data={() => ({
                                        ...data(),
                                        before: moveBefore.id,
                                    })}
                                />
                            ) : null}
                            {row.actions.complete ? (
                                <ConfirmAction
                                    label="Complete, free the bay now"
                                    ariaLabel={`Release the buffer and complete ${row.customerName}`}
                                    title={`Complete ${row.customerName} and release the buffer?`}
                                    description="The bay becomes free immediately instead of after its cleaning buffer. This is recorded with your reason."
                                    confirmLabel="Complete and release"
                                    confirmVariant="default"
                                    reasonLabel="Why release the buffer early?"
                                    reasonRequired
                                    url={url('complete')}
                                    data={() => ({
                                        ...data(),
                                        release_buffer: 1,
                                    })}
                                />
                            ) : null}
                            {row.actions.noShow ? (
                                <ConfirmAction
                                    label="No-show"
                                    ariaLabel={`Mark ${row.customerName} as a no-show`}
                                    title={`Mark ${row.customerName} as a no-show?`}
                                    description={`This releases ${formatTime(row.startAt, timezone)} on ${row.resource.name} and emails the customer. It cannot be undone.`}
                                    confirmLabel="Confirm no-show"
                                    dismissLabel="Keep booking"
                                    reasonLabel="Reason (kept in the audit log)"
                                    reasonRequired
                                    url={url('no-show')}
                                    data={() => ({ ...data(), confirm: 1 })}
                                />
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </li>
    );
}
