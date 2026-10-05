import type { ReactNode } from 'react';
import { StatusChip } from '@/components/owner/status-chip';
import { Card, CardContent } from '@/components/ui/card';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatMinutes, minutesUntil } from '@/lib/conflicts';
import type { ConflictRowData } from '@/types/conflicts';

type Props = {
    row: ConflictRowData;
    timezone: string;
    now: number;
    /** The withdraw control, rendered by the page that owns the mutation. */
    withdraw?: ReactNode;
};

const OUTCOME_WORDS = {
    declined: 'The customer declined the proposed time.',
    expired: 'The customer did not answer before the deadline.',
    withdrawn: 'The proposal was withdrawn.',
    replaced: 'The proposal was replaced.',
    accepted: 'The customer accepted.',
} as const;

/**
 * What the customer has been asked and how they answered. The original
 * appointment is always stated as still reserved, and a declined or expired
 * proposal is explained as returning the conflict to staff.
 */
export function CustomerResponseCard({ row, timezone, now, withdraw }: Props) {
    const proposal = row.proposal;
    const original = row.booking
        ? formatDayAndTime(row.booking.startAt, timezone)
        : '';

    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-3 px-5">
                <div className="grid gap-1">
                    <h2 className="text-xl font-semibold">Customer response</h2>
                    <p className="text-sm text-muted-foreground">
                        Only one active proposal at a time.
                    </p>
                </div>

                {proposal ? (
                    <>
                        <p>
                            <StatusChip tone="warning" caps>
                                Awaiting reply
                            </StatusChip>
                        </p>
                        <div className="grid gap-1">
                            <p className="text-sm text-muted-foreground">
                                Proposed
                            </p>
                            <p className="text-lg font-semibold tabular-nums">
                                {formatDayAndTime(proposal.startAt, timezone)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {proposal.resource}
                            </p>
                        </div>
                        <p className="font-semibold text-warning tabular-nums">
                            {proposal.lapsed ||
                            minutesUntil(proposal.expiresAt, now) === 0
                                ? 'Hold expired. This returns to staff shortly.'
                                : `Hold expires in ${formatMinutes(minutesUntil(proposal.expiresAt, now))}`}
                        </p>
                        {withdraw}
                    </>
                ) : row.lastOutcome ? (
                    <div className="grid gap-1">
                        <p>
                            <StatusChip tone="warning" caps>
                                {row.lastOutcome.status === 'declined'
                                    ? 'Declined'
                                    : row.lastOutcome.status === 'expired'
                                      ? 'Expired'
                                      : 'Not active'}
                            </StatusChip>
                        </p>
                        <p className="text-sm">
                            {OUTCOME_WORDS[row.lastOutcome.status]} They were
                            offered{' '}
                            <span className="tabular-nums">
                                {formatDayAndTime(
                                    row.lastOutcome.startAt,
                                    timezone,
                                )}
                            </span>
                            . The conflict is back with staff.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm">
                        No proposal sent yet. The customer has not been
                        contacted.
                    </p>
                )}

                <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Original {original} reservation remains held.</p>
                    <p>
                        If declined or expired, the conflict returns to staff.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
