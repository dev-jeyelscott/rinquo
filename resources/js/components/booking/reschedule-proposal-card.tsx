import { useForm } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowRightIcon,
    ArrowUpRightIcon,
    ClockIcon,
    InfoIcon,
    TriangleAlertIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { RefObject } from 'react';
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
import { formatLongDayAndTime, formatTime } from '@/lib/booking-format';
import { minutesUntil } from '@/lib/conflicts';
import { formatInstant } from '@/lib/datetime';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { ProposalForCustomer } from '@/types/conflicts';

type Props = {
    proposal: ProposalForCustomer;
    /** The confirmed appointment that stays reserved until the customer accepts. */
    originalStartAt: string;
    timezone: string;
    acceptUrl: string;
    declineUrl: string;
    /** Receives focus when the page opens on the proposal, and after the customer keeps the original. */
    heading: RefObject<HTMLHeadingElement | null>;
    /** Called once the customer's answer has been applied and the proposal is gone. */
    onAnswered: () => void;
};

/** "Sun, Oct 11 · 9:30 AM" in the branch timezone (the Spec 03 comparison format). */
function dayAndTime(instant: string, timeZone: string): string {
    const day = formatInstant(instant, timeZone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    return `${day} · ${formatTime(instant, timeZone)}`;
}

function Side({
    label,
    instant,
    note,
    timezone,
    emphasis,
}: {
    label: string;
    instant: string;
    note: string;
    timezone: string;
    emphasis?: boolean;
}) {
    return (
        <div
            className={cn(
                'grid gap-1 rounded-xl border p-4',
                emphasis ? 'border-primary bg-primary/5' : 'bg-secondary/40',
            )}
        >
            <p className="text-xs font-medium tracking-wide text-foreground/80 uppercase">
                {label}
            </p>
            <p className="text-lg font-semibold tabular-nums">
                {dayAndTime(instant, timezone)}
            </p>
            <p className="text-sm text-foreground/80">{note}</p>
        </div>
    );
}

/**
 * The shop's proposal to move a booking, as the customer sees it (Spec 03
 * references 12 and 13): the shop's suggestion with the original stated as
 * still confirmed and reserved, a comparison of the current appointment and the
 * requested replacement, the response deadline, and the two decisions. Accepting
 * is deliberate (a dialog that says the replacement is secured before the
 * original is released); declining changes nothing. On small screens the two
 * decisions sit in a bar fixed to the bottom of the viewport. Neither resource
 * nor capacity detail is ever shown to the customer.
 */
export function RescheduleProposalCard({
    proposal,
    originalStartAt,
    timezone,
    acceptUrl,
    declineUrl,
    heading,
    onAnswered,
}: Props) {
    const now = useNow(30000);
    const [confirming, setConfirming] = useState(false);
    const opener = useRef<HTMLButtonElement>(null);
    const accepted = useRef(false);
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
        <>
            <Alert role={undefined} className={ALERT_TONES.warning}>
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>
                    The shop suggested a new appointment time
                </AlertTitle>
                <AlertDescription>
                    Your current confirmed appointment remains reserved until
                    you accept the replacement.
                </AlertDescription>
            </Alert>
            <section
                aria-labelledby="proposal-heading"
                className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
            >
                <div className="flex items-center justify-between gap-2">
                    <h2
                        id="proposal-heading"
                        ref={heading}
                        tabIndex={-1}
                        className="text-lg font-semibold outline-none max-sm:text-base"
                    >
                        Review proposed time
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warning-text">
                        <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-current"
                        />
                        Response needed
                    </span>
                </div>
                <div className="grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr] lg:gap-3">
                    <Side
                        label="Current appointment"
                        instant={originalStartAt}
                        note="Confirmed and still reserved"
                        timezone={timezone}
                    />
                    <ArrowRightIcon
                        aria-hidden="true"
                        className="hidden size-5 text-primary lg:block"
                    />
                    <ArrowDownIcon
                        aria-hidden="true"
                        className="mx-auto size-5 text-primary lg:hidden"
                    />
                    <Side
                        label="Requested replacement"
                        instant={proposal.startAt}
                        note="Philippine time"
                        timezone={timezone}
                        emphasis
                    />
                </div>
                <p className="flex items-start gap-2 text-sm text-muted-foreground tabular-nums">
                    <ClockIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0"
                    />
                    {minutes === 0
                        ? 'This proposal is about to expire.'
                        : `Respond by ${formatLongDayAndTime(proposal.expiresAt, timezone).replace(' · ', ' at ')}, Philippine time.`}
                </p>
                {error ? (
                    <Alert role="alert" className={ALERT_TONES.warning}>
                        <AlertTitle>That did not go through</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
                <div
                    role="group"
                    aria-label="Respond to the proposed time"
                    className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:justify-between lg:border-t-0 lg:bg-transparent lg:p-0"
                >
                    <Button
                        type="button"
                        variant="outline"
                        className="border-booking-control max-lg:h-12 max-lg:shrink-0"
                        disabled={busy}
                        aria-busy={decline.processing}
                        onClick={() =>
                            decline.post(declineUrl, {
                                onSuccess: onAnswered,
                            })
                        }
                    >
                        {decline.processing ? (
                            'Declining…'
                        ) : (
                            <>
                                <span className="max-lg:hidden">
                                    Keep my original time
                                </span>
                                <span className="lg:hidden">Keep original</span>
                            </>
                        )}
                    </Button>
                    <Button
                        ref={opener}
                        type="button"
                        className="max-lg:h-12 max-lg:flex-1"
                        disabled={busy}
                        onClick={() => setConfirming(true)}
                    >
                        Accept new time
                    </Button>
                </div>
            </section>
            <p className="text-sm text-muted-foreground">
                Declining keeps the existing appointment; the shop will follow
                up about the conflict.
            </p>
            <Dialog open={confirming} onOpenChange={setConfirming}>
                <DialogContent
                    onCloseAutoFocus={(event) => {
                        // Any dismissal that is not a successful accept returns to the opener;
                        // after an accept the outcome heading takes focus instead.
                        if (!accepted.current) {
                            event.preventDefault();
                            opener.current?.focus();
                        }
                    }}
                >
                    <DialogHeader className="text-left">
                        <div className="flex items-center gap-3">
                            <span
                                aria-hidden="true"
                                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                            >
                                <ArrowUpRightIcon className="size-5" />
                            </span>
                            <DialogTitle className="text-xl leading-tight">
                                Accept the new time?
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            Move your appointment from{' '}
                            {formatLongDayAndTime(
                                originalStartAt,
                                timezone,
                            ).replace(' · ', ' at ')}{' '}
                            to{' '}
                            <strong className="font-semibold text-foreground">
                                {formatLongDayAndTime(
                                    proposal.startAt,
                                    timezone,
                                ).replace(' · ', ' at ')}
                            </strong>
                            .
                        </DialogDescription>
                    </DialogHeader>
                    <Alert role={undefined} className={ALERT_TONES.info}>
                        <InfoIcon aria-hidden="true" />
                        <AlertTitle>Your booking stays protected</AlertTitle>
                        <AlertDescription>
                            We will secure the replacement before releasing your
                            original appointment. If acceptance fails, the
                            original stays reserved.
                        </AlertDescription>
                    </Alert>
                    <DialogFooter className="flex-row justify-end max-sm:[&>*]:flex-1">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-booking-control max-sm:h-11"
                            onClick={() => setConfirming(false)}
                        >
                            Keep original
                        </Button>
                        <Button
                            type="button"
                            className="max-sm:h-11"
                            disabled={accept.processing}
                            aria-busy={accept.processing}
                            onClick={() =>
                                accept.post(acceptUrl, {
                                    onSuccess: () => {
                                        accepted.current = true;
                                    },
                                    onFinish: () => setConfirming(false),
                                })
                            }
                        >
                            {accept.processing
                                ? 'Accepting…'
                                : 'Accept new time'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
