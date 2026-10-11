import type { ReactNode } from 'react';
import { OPERATION_STATE } from '@/components/operations/operation-state';
import { useOperationsLocked } from '@/components/operations/operations-lock';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { formatTime } from '@/lib/booking-format';
import type { QueueRowData } from '@/types/operations';

type Props = {
    row: QueueRowData;
    baseUrl: string;
    timezone: string;
    moveBefore: QueueRowData | null;
    now: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Issues the revision and idempotency key for one operation on this booking. */
    data: () => { revision: number; idempotency_key: string };
    /** Closes this sheet and opens the assignment sheet: one sheet is active at a time. */
    onAssign: () => void;
    /** The routine next action, worded for the sheet footer; null when there is none. */
    primary: {
        label: string;
        busy: string;
        pending: boolean;
        onRun: () => void;
    } | null;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs font-semibold text-muted-foreground">
                {label}
            </dt>
            <dd className="text-sm font-semibold break-words">{children}</dd>
        </div>
    );
}

/**
 * Read-only booking context (Spec 04 reference 03) as a contextual sheet: a
 * bottom sheet on phones and a side drawer from `sm`, so the queue stays
 * visible and focus returns to the customer name that opened it. It shows only
 * fields the Operations read model already carries, holds the secondary
 * actions the row leaves out, and says plainly when a no-show is not yet
 * allowed. Every action is still validated by the server against the current
 * revision, and all are disabled while the board is offline.
 */
export function BookingDetailsSheet({
    row,
    baseUrl,
    timezone,
    moveBefore,
    now,
    open,
    onOpenChange,
    data,
    onAssign,
    primary,
}: Props) {
    const locked = useOperationsLocked();
    const url = (path: string) => `${baseUrl}/${row.id}/${path}`;
    const scheduled = row.state === 'scheduled';
    const beforeGrace =
        scheduled &&
        new Date(now).getTime() < new Date(row.noShowEligibleAt).getTime();
    const hasOther =
        (row.actions.reorder && moveBefore !== null) ||
        row.actions.complete ||
        row.actions.noShow;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <button
                    type="button"
                    data-row-details
                    aria-label={`Booking details for ${row.customerName}`}
                    className="w-fit rounded-sm text-left text-base font-semibold underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none max-xl:min-h-11"
                >
                    {row.customerName}
                </button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[92%] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 sm:w-[44vw] sm:max-w-xl sm:min-w-80">
                <SheetHeader className="border-b p-4 pr-12">
                    <SheetTitle className="text-xl">Booking details</SheetTitle>
                    <SheetDescription>
                        {row.customerName} · scheduled{' '}
                        {formatTime(row.startAt, timezone)}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 px-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <Field label="Customer">{row.customerName}</Field>
                        <Field label="Phone">{row.customerPhone ?? '—'}</Field>
                        <Field label="Vehicle">{row.vehicleName}</Field>
                        <Field label="Plate">{row.vehiclePlate ?? '—'}</Field>
                        <Field label="Service">
                            {[row.serviceName, ...row.addOns].join(' + ')}
                        </Field>
                        <Field label="Scheduled start">
                            {formatTime(row.startAt, timezone)}
                        </Field>
                        <Field label="Booked resource type">
                            {row.resourceTypeName}
                        </Field>
                        <Field label="Current resource">
                            {row.resource.name}
                        </Field>
                        {row.etaAt ? (
                            <Field label="Expected finish">
                                {formatTime(row.etaAt, timezone)}
                            </Field>
                        ) : null}
                        {row.lateArrivalAt ? (
                            <Field label="Late arrival">
                                {formatTime(row.lateArrivalAt, timezone)}
                            </Field>
                        ) : null}
                    </dl>
                    {row.notes ? (
                        <p className="rounded-xl bg-secondary p-3 text-sm">
                            <span className="font-semibold">Notes: </span>
                            {row.notes}
                        </p>
                    ) : null}
                    <div className="grid gap-2 border-t pt-4">
                        <p>
                            <StatusChip tone={OPERATION_STATE[row.state].tone}>
                                {OPERATION_STATE[row.state].label}
                            </StatusChip>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Appointment time and reserved priority stay
                            unchanged. Actions are validated against the current
                            booking revision.
                        </p>
                        {scheduled ? (
                            <p className="text-sm">
                                {beforeGrace
                                    ? `No-show can be confirmed from ${formatTime(row.noShowEligibleAt, timezone)}, after the ${row.graceMinutes}-minute grace period. Until then the customer can still check in on time.`
                                    : `The ${row.graceMinutes}-minute grace period ended at ${formatTime(row.noShowEligibleAt, timezone)}. A customer who arrives now is checked in as a late arrival and the booking stays confirmed.`}
                            </p>
                        ) : null}
                    </div>
                    {hasOther ? (
                        <div
                            role="group"
                            aria-label="Other actions"
                            className="flex flex-wrap items-center gap-2"
                        >
                            {row.actions.reorder && moveBefore ? (
                                <ConfirmAction
                                    label="Move up"
                                    ariaLabel={`Move up: ${row.customerName} ahead of ${moveBefore.customerName}`}
                                    title={`Move ${row.customerName} ahead of ${moveBefore.customerName}?`}
                                    description="Only the order of work changes. Appointment start times stay unchanged and this does not overbook a bay or override confirmed capacity."
                                    confirmLabel="Confirm move up"
                                    dismissLabel="Keep order"
                                    confirmVariant="default"
                                    reasonLabel="Reason for moving (kept in the audit log)"
                                    reasonRequired
                                    disabled={locked}
                                    onSettled={() => onOpenChange(false)}
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
                                    disabled={locked}
                                    onSettled={() => onOpenChange(false)}
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
                                    description={`The ${row.graceMinutes}-minute grace period has passed. This releases ${formatTime(row.startAt, timezone)} on ${row.resource.name} and emails the customer if they gave an address. It cannot be undone.`}
                                    confirmLabel="Confirm no-show"
                                    dismissLabel="Keep booking"
                                    reasonLabel="Reason (kept in the audit log)"
                                    reasonRequired
                                    disabled={locked}
                                    onSettled={() => onOpenChange(false)}
                                    url={url('no-show')}
                                    data={() => ({ ...data(), confirm: 1 })}
                                />
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t">
                    {row.actions.assign ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            disabled={locked}
                            aria-label={`Assign resource for ${row.customerName}`}
                            onClick={onAssign}
                        >
                            Assign resource
                        </Button>
                    ) : null}
                    {primary ? (
                        <Button
                            type="button"
                            className="max-sm:h-11"
                            disabled={primary.pending || locked}
                            aria-busy={primary.pending}
                            onClick={primary.onRun}
                        >
                            {primary.pending ? (
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {primary.pending ? primary.busy : primary.label}
                        </Button>
                    ) : null}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
