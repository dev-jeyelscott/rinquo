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
};

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
}: Props) {
    const now = useNow(30000);
    const [chosen, setChosen] = useState('');
    const key = useOperationKey(`${row.id}:${row.revision}:${chosen}`);
    const status = statusLabel(row);
    const booking = row.booking;
    const base = `${conflictsUrl}/${row.id}/proposal`;
    const replacing = row.proposal !== null;
    const times = candidates?.times ?? [];
    const when = chosen ? formatDayAndTime(chosen, timezone) : '';

    if (booking === null) {
        return null;
    }

    return (
        <div className="grid gap-4">
            {row.status === 'resolved' ? (
                <Alert className={ALERT_TONES.success} role="status">
                    <AlertTitle className="line-clamp-none">
                        {status.label}
                    </AlertTitle>
                    <AlertDescription className="text-foreground">
                        {row.resolution === 'same_time_reassigned'
                            ? `Moved from ${row.originalResource} to ${row.reassignedResource} at the same time. The customer was not contacted.`
                            : row.resolution === 'customer_accepted'
                              ? 'The customer accepted a new time and their booking was replaced.'
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
                            <p className="text-sm text-muted-foreground">
                                {booking.status === 'confirmed'
                                    ? 'Confirmed'
                                    : booking.status.replace('_', ' ')}{' '}
                                · conflict is a separate operational state
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
                            ) : null}
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
                                        description="The proposed time is released. Their original appointment stays reserved and the conflict returns to staff."
                                        confirmLabel="Withdraw proposal"
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
                                    <p className="text-sm">
                                        This customer has no account to answer a
                                        proposal. Contact them directly
                                        {booking.customerPhone
                                            ? ` on ${booking.customerPhone}`
                                            : ''}
                                        , then cancel or rebook from Operations.
                                    </p>
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
                                    <p className="text-sm">
                                        No open times in the next 7 days for
                                        this service. Free up capacity or
                                        contact the customer directly.
                                    </p>
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
                                            description={`${booking.customerName} is emailed ${when}. Their current appointment stays reserved and nothing changes unless they accept before the deadline.`}
                                            confirmLabel={
                                                replacing
                                                    ? 'Replace proposal'
                                                    : 'Send proposal'
                                            }
                                            confirmVariant="default"
                                            triggerVariant="default"
                                            disabled={chosen === ''}
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
