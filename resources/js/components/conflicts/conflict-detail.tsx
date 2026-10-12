import { Link } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { CandidateTimes } from '@/components/conflicts/candidate-times';
import { CustomerResponseCard } from '@/components/conflicts/customer-response-card';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { useOperationKey } from '@/hooks/use-operation-key';
import { formatDayAndTime } from '@/lib/booking-format';
import { causeSentence, statusLabel } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import type { ConflictsPageData, ConflictRowData } from '@/types/conflicts';

type Props = {
    row: ConflictRowData;
    candidates: ConflictsPageData['candidates'];
    timezone: string;
    conflictsUrl: string;
    operationsUrl: string;
    /**
     * True while the screen cannot vouch for what it shows: offline, refreshing,
     * a failed read, or a stale revision or time that has not been refreshed yet.
     * Proposal actions stay disabled and any chosen time is dropped.
     */
    locked?: boolean;
};

const REFRESH_FIRST =
    'The connection was interrupted, so it is not known whether this reached the server. Refresh the conflict before trying again; nothing is repeated automatically.';

const PAUSED =
    'Actions are paused until this conflict is refreshed. Nothing was sent or changed.';

/** A stable place for focus once the control that opened a dialog is gone or disabled. */
function resolutionHeading(): HTMLElement | null {
    return document.getElementById('resolution-heading');
}

/**
 * The resolution pane. The protected original appointment sits beside the
 * proposal so a member never loses sight of what is reserved; sending or
 * replacing a proposal needs one deliberate confirmation because it e-mails a
 * customer and holds capacity. Resolved conflicts are read-only evidence.
 */
export function ConflictDetail({
    row,
    candidates,
    timezone,
    conflictsUrl,
    operationsUrl,
    locked = false,
}: Props) {
    const now = useNow(30000);
    const [chosen, setChosen] = useState('');
    const [wasLocked, setWasLocked] = useState(locked);
    const [epoch, setEpoch] = useState(0);

    // A time picked before the screen lost its footing is a stale claim: drop it.
    if (locked !== wasLocked) {
        setWasLocked(locked);

        if (locked) {
            setChosen('');
            setEpoch((current) => current + 1);
        }
    }

    const key = useOperationKey(`${row.id}:${row.revision}:${chosen}:${epoch}`);
    const status = statusLabel(row);
    const booking = row.booking;
    const base = `${conflictsUrl}/${row.id}/proposal`;
    const replacing = row.proposal !== null;
    const times = candidates?.times ?? [];
    const when = chosen ? formatDayAndTime(chosen, timezone) : '';

    if (booking === null) {
        return null;
    }

    const original = formatDayAndTime(booking.startAt, timezone);
    const accepted =
        row.resolution === 'customer_accepted' &&
        row.lastOutcome?.status === 'accepted'
            ? formatDayAndTime(row.lastOutcome.startAt, timezone)
            : null;

    return (
        <div className="grid gap-4">
            {row.status === 'resolved' ? (
                <Alert className={ALERT_TONES.success} role="status">
                    <AlertTitle className="line-clamp-none">
                        {status.label}
                    </AlertTitle>
                    <AlertDescription className="text-foreground">
                        {row.resolution === 'same_time_reassigned'
                            ? `Moved from ${row.originalResource} to ${row.reassignedResource}. The appointment time did not change: ${original}. The customer was not contacted.`
                            : row.resolution === 'customer_accepted'
                              ? accepted
                                  ? `The customer accepted ${accepted}. That time is now confirmed and the original ${original} time is released.`
                                  : 'The customer accepted a new time and their booking was replaced. The original time is released.'
                              : 'The booking ended, so there is nothing left to resolve.'}
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert className={ALERT_TONES.error} role="status">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertTitle className="line-clamp-none">
                        Booking cannot be fulfilled as scheduled
                    </AlertTitle>
                    <AlertDescription className="text-foreground">
                        {causeSentence(row)}{' '}
                        {row.cause === 'hours'
                            ? 'Another resource cannot fix this.'
                            : 'Same-time compatible reassignment failed.'}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid items-start gap-4 2xl:grid-cols-2">
                <div className="grid gap-4">
                    <Card className="rounded-2xl py-5 shadow-none">
                        <CardContent className="grid gap-2 px-5">
                            <h2 className="text-xl font-semibold">
                                Affected booking
                            </h2>
                            <p className="flex flex-wrap items-center gap-2">
                                <StatusChip
                                    tone={
                                        booking.status === 'confirmed'
                                            ? 'success'
                                            : 'neutral'
                                    }
                                >
                                    Booking{' '}
                                    {booking.status.replaceAll('_', ' ')}
                                </StatusChip>
                                <StatusChip tone={status.tone}>
                                    Conflict: {status.label}
                                </StatusChip>
                            </p>
                            <p className="text-lg font-semibold">
                                {booking.customerName}
                            </p>
                            {booking.customerPhone ? (
                                <p className="text-sm tabular-nums">
                                    {booking.customerPhone}
                                </p>
                            ) : null}
                            <p className="text-muted-foreground">
                                {booking.vehicleName} · {booking.serviceName}
                            </p>
                            <p className="text-lg font-semibold tabular-nums">
                                {formatDayAndTime(booking.startAt, timezone)}
                            </p>
                            {row.status !== 'resolved' ? (
                                <p className="font-semibold text-primary">
                                    Original slot remains reserved
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {row.resolution === 'customer_accepted'
                                        ? 'This original time is released.'
                                        : row.resolution ===
                                            'same_time_reassigned'
                                          ? 'Still booked at this time.'
                                          : null}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground tabular-nums">
                                Duration snapshot: {booking.durationMinutes} min
                                + {booking.bufferMinutes} min buffer
                            </p>
                        </CardContent>
                    </Card>

                    {row.status !== 'resolved' ? (
                        <CustomerResponseCard
                            row={row}
                            timezone={timezone}
                            now={now}
                            withdraw={
                                row.actions.withdraw ? (
                                    <ConfirmAction
                                        label="Withdraw proposal"
                                        ariaLabel={`Withdraw the proposal to ${booking.customerName}`}
                                        title="Withdraw this proposal?"
                                        description={`Only the held proposed time${row.proposal ? ` (${formatDayAndTime(row.proposal.startAt, timezone)})` : ''} is released and ${booking.customerName} can no longer accept it. Their original ${original} appointment stays reserved, and the conflict returns to staff.`}
                                        confirmLabel="Withdraw proposal"
                                        disabled={locked}
                                        disabledMessage={PAUSED}
                                        returnFocus={resolutionHeading}
                                        networkErrorMessage={REFRESH_FIRST}
                                        dismissLabel="Keep proposal"
                                        url={`${base}/withdraw`}
                                        data={() => ({
                                            revision: row.revision,
                                            idempotency_key: key(),
                                        })}
                                    />
                                ) : null
                            }
                        />
                    ) : null}
                </div>

                {row.status !== 'resolved' ? (
                    <Card className="rounded-2xl py-5 shadow-none">
                        <CardContent className="grid gap-4 px-5">
                            <div className="grid gap-1">
                                <h2 className="text-xl font-semibold">
                                    Resolve conflict
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Preserve capacity integrity. Never silently
                                    move a customer.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                                <h3 className="font-semibold">
                                    1. Same-time reassignment
                                </h3>
                                <StatusChip tone="warning">
                                    No safe resource
                                </StatusChip>
                            </div>

                            <div className="grid gap-3">
                                <h3 className="font-semibold">
                                    2. Propose a new appointment time
                                </h3>
                                {!booking.hasAccount ? (
                                    <div className="grid gap-2 text-sm">
                                        <p>
                                            This customer has no account to
                                            answer a proposal. Contact them
                                            directly
                                            {booking.customerPhone
                                                ? ` on ${booking.customerPhone}`
                                                : ''}
                                            , then cancel or rebook from
                                            Operations.
                                        </p>
                                        <p className="text-muted-foreground">
                                            The original {original} appointment
                                            stays reserved until then.
                                        </p>
                                        <ManualNextStep href={operationsUrl} />
                                    </div>
                                ) : !row.actions.propose ? (
                                    <p className="text-sm">
                                        This booking can no longer be
                                        rescheduled.
                                    </p>
                                ) : candidates?.error ? (
                                    <p role="alert" className="text-sm">
                                        {candidates.error}
                                    </p>
                                ) : times.length === 0 ? (
                                    <div className="grid gap-2 text-sm">
                                        <p>
                                            No open times in the next 7 days for
                                            this service. Free up capacity or
                                            contact the customer directly.
                                        </p>
                                        <p className="text-muted-foreground">
                                            The original {original} appointment
                                            stays reserved. Nothing was sent.
                                        </p>
                                        <ManualNextStep href={operationsUrl} />
                                    </div>
                                ) : (
                                    <>
                                        <CandidateTimes
                                            legend="Available times"
                                            times={times}
                                            value={chosen}
                                            onChange={setChosen}
                                            timezone={timezone}
                                        />
                                        <p className="text-sm font-semibold text-muted-foreground">
                                            Customer approval required before
                                            schedule changes.
                                        </p>
                                        {locked ? (
                                            <p className="text-sm text-muted-foreground">
                                                Sending is paused until this
                                                conflict is refreshed.
                                            </p>
                                        ) : null}
                                        <ConfirmAction
                                            label={
                                                replacing
                                                    ? 'Replace proposal'
                                                    : 'Send reschedule proposal'
                                            }
                                            ariaLabel={
                                                replacing
                                                    ? `Replace the proposal to ${booking.customerName}`
                                                    : `Send a reschedule proposal to ${booking.customerName}`
                                            }
                                            title={`${replacing ? 'Replace' : 'Send'} the proposal to ${booking.customerName}?`}
                                            description={
                                                replacing && row.proposal
                                                    ? `The active proposal for ${formatDayAndTime(row.proposal.startAt, timezone)} is released and ${booking.customerName} is emailed ${when} instead; only one proposal can be active. ${when} is held temporarily. Their original ${original} appointment stays reserved and nothing changes unless they accept before the deadline.`
                                                    : `${booking.customerName} is emailed ${when}. That time is held temporarily beside their original ${original} appointment, which stays reserved. Nothing changes unless they accept before the deadline.`
                                            }
                                            confirmLabel={
                                                replacing
                                                    ? 'Replace proposal'
                                                    : 'Send proposal'
                                            }
                                            confirmVariant="default"
                                            triggerVariant="default"
                                            disabled={chosen === '' || locked}
                                            disabledMessage={
                                                locked ? PAUSED : undefined
                                            }
                                            returnFocus={resolutionHeading}
                                            networkErrorMessage={REFRESH_FIRST}
                                            url={base}
                                            data={() => ({
                                                revision: row.revision,
                                                idempotency_key: key(),
                                                start_at: chosen,
                                            })}
                                        />
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}

/** The safe manual path when no proposal can be sent: handle it in Operations, nothing is changed here. */
function ManualNextStep({ href }: { href: string }) {
    return (
        <p>
            <Link
                href={href}
                className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none max-sm:inline-block max-sm:py-3"
            >
                Open Operations
            </Link>
        </p>
    );
}
