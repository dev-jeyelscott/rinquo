import { useForm } from '@inertiajs/react';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useNow } from '@/hooks/use-now';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatMinutes, minutesUntil } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import type { ProposalForCustomer } from '@/types/conflicts';

type Props = {
    proposal: ProposalForCustomer;
    /** The confirmed appointment that stays reserved until the customer accepts. */
    originalStartAt: string;
    timezone: string;
    acceptUrl: string;
    declineUrl: string;
};

/**
 * The shop's proposal to move a booking, as the customer sees it. The original
 * appointment is stated first as still confirmed and reserved; the proposed
 * time and response deadline follow. Accepting is deliberate (it releases the
 * original time) and declining changes nothing. Neither resource nor capacity
 * detail is ever shown to the customer.
 */
export function RescheduleProposalCard({
    proposal,
    originalStartAt,
    timezone,
    acceptUrl,
    declineUrl,
}: Props) {
    const now = useNow(30000);
    const [confirming, setConfirming] = useState(false);
    const base = {
        proposal: proposal.id,
        revision: proposal.revision,
    };
    const accept = useForm({ ...base, idempotency_key: crypto.randomUUID() });
    const decline = useForm({ ...base, idempotency_key: crypto.randomUUID() });
    const minutes = minutesUntil(proposal.expiresAt, now);
    const busy = accept.processing || decline.processing;
    const error = accept.errors.proposal ?? decline.errors.proposal;

    return (
        <section
            aria-labelledby="proposal-heading"
            className="grid gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4"
        >
            <div className="grid gap-1">
                <h2
                    id="proposal-heading"
                    className="flex items-center gap-2 font-semibold"
                >
                    <CalendarClockIcon aria-hidden="true" className="size-4" />
                    The shop proposed a new time
                </h2>
                <p className="text-sm">
                    Your booking is still confirmed for{' '}
                    <span className="font-semibold tabular-nums">
                        {formatDayAndTime(originalStartAt, timezone)}
                    </span>{' '}
                    and stays reserved unless you accept the new time.
                </p>
            </div>
            <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">Proposed time</p>
                <p className="text-lg font-semibold tabular-nums">
                    {formatDayAndTime(proposal.startAt, timezone)} (Philippine
                    time)
                </p>
                <p className="text-sm tabular-nums">
                    {minutes === 0
                        ? 'This proposal is about to expire.'
                        : `Please answer within ${formatMinutes(minutes)}, by ${formatDayAndTime(proposal.expiresAt, timezone)}.`}
                </p>
            </div>
            {error ? (
                <Alert role="alert" className={ALERT_TONES.warning}>
                    <AlertTitle>That did not go through</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    className="max-sm:h-11"
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                >
                    Accept new time
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="max-sm:h-11"
                    disabled={busy}
                    aria-busy={decline.processing}
                    onClick={() => decline.post(declineUrl)}
                >
                    {decline.processing
                        ? 'Declining…'
                        : 'Keep my original time'}
                </Button>
            </div>
            <Dialog open={confirming} onOpenChange={setConfirming}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move your booking?</DialogTitle>
                        <DialogDescription>
                            Your booking moves to{' '}
                            {formatDayAndTime(proposal.startAt, timezone)} and
                            your original time is released. We email you a
                            confirmation.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={() => setConfirming(false)}
                        >
                            Keep my original time
                        </Button>
                        <Button
                            type="button"
                            className="max-sm:h-11"
                            disabled={accept.processing}
                            aria-busy={accept.processing}
                            onClick={() =>
                                accept.post(acceptUrl, {
                                    onFinish: () => setConfirming(false),
                                })
                            }
                        >
                            {accept.processing ? 'Moving…' : 'Accept new time'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
