import { router, usePage } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDayAndTime } from '@/lib/booking-format';
import { CAUSE_LABELS } from '@/lib/conflicts';
import { ALERT_TONES } from '@/lib/tones';
import type { ScheduleImpact } from '@/types/conflicts';

type Submission = {
    method: 'post' | 'put' | 'patch' | 'delete';
    url: string;
    data: Record<string, unknown>;
};

/**
 * Review step for a scheduling change that would disrupt future bookings (a
 * resource block, a capacity, hours, service-window or compatibility change).
 * The server has already planned the impact and written nothing; this dialog
 * shows exactly that plan and, on "Apply changes", repeats the very same
 * submission with the server-issued confirmation token. If the world changed in
 * the meantime the server answers with a refreshed plan, which replaces this
 * one and says so; counts shown here are never computed by the client.
 *
 * It lives in the Owner shell, so every page that can change scheduling gets
 * the same review without each form knowing about it.
 */
export function ScheduleImpactDialog() {
    const { props } = usePage();
    const impact = props.flash.schedulingImpact ?? null;
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [dismissed, setDismissed] = useState<ScheduleImpact | null>(null);
    const [applying, setApplying] = useState(false);

    // Remember the last write the user attempted so it can be confirmed unchanged.
    useEffect(
        () =>
            router.on('before', (event) => {
                const visit = event.detail.visit;
                const data = visit.data;

                if (
                    visit.method !== 'get' &&
                    data !== null &&
                    typeof data === 'object' &&
                    !(data instanceof FormData)
                ) {
                    setSubmission({
                        method: visit.method,
                        url: visit.url.pathname + visit.url.search,
                        data: data as Record<string, unknown>,
                    });
                }
            }),
        [],
    );

    if (impact === null) {
        return null;
    }

    const open = impact !== dismissed;

    function apply() {
        if (impact === null || submission === null) {
            return;
        }

        router.visit(submission.url, {
            method: submission.method,
            data: { ...submission.data, impact_token: impact.token },
            preserveScroll: true,
            onStart: () => setApplying(true),
            onFinish: () => setApplying(false),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setDismissed(impact);
                }
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {impact.affected === 0
                            ? 'No future bookings are affected'
                            : impact.affected === 1
                              ? '1 future booking is affected'
                              : `${impact.affected} future bookings are affected`}
                    </DialogTitle>
                    <DialogDescription>
                        Applying this change never moves an appointment time and
                        never contacts a customer. Review what happens to each
                        booking first.
                    </DialogDescription>
                </DialogHeader>

                {impact.stale ? (
                    <Alert className={ALERT_TONES.warning} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            Bookings changed since you last looked, so nothing
                            was applied. This is the updated impact.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <p className="flex flex-wrap gap-2 text-sm tabular-nums">
                    <StatusChip tone="success">
                        {impact.reassigned} stay at the same time
                    </StatusChip>
                    <StatusChip tone="warning">
                        {impact.conflicts} need staff action
                    </StatusChip>
                </p>

                {impact.bookings.length > 0 ? (
                    <ul
                        aria-label="Affected bookings"
                        className="grid max-h-64 gap-2 overflow-y-auto"
                    >
                        {impact.bookings.map((booking) => (
                            <li
                                key={booking.id}
                                className="grid gap-1 rounded-xl border p-3 text-sm"
                            >
                                <p className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-semibold">
                                        {booking.customerName}
                                    </span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {formatDayAndTime(
                                            booking.startAt,
                                            booking.timezone,
                                        )}
                                    </span>
                                </p>
                                <p className="text-muted-foreground">
                                    {booking.serviceName} ·{' '}
                                    {CAUSE_LABELS[booking.cause]}
                                </p>
                                <p className="font-semibold">
                                    {booking.outcome === 'reassigned'
                                        ? `Moves from ${booking.fromResource ?? 'its resource'} to ${booking.toResource ?? 'another resource'} at the same time`
                                        : 'Needs a staff decision. The original time stays reserved.'}
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Nothing needs to move. You can apply the change.
                    </p>
                )}
                {impact.truncated > 0 ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                        and {impact.truncated} more
                    </p>
                ) : null}

                {submission === null ? (
                    <p role="alert" className="text-sm text-destructive">
                        This review is no longer connected to your change. Close
                        it and submit the change again.
                    </p>
                ) : null}

                <DialogFooter>
                    <Button
                        variant="outline"
                        className="max-sm:h-11"
                        onClick={() => setDismissed(impact)}
                    >
                        Keep current settings
                    </Button>
                    <Button
                        className="max-sm:h-11"
                        onClick={apply}
                        disabled={applying || submission === null}
                        aria-busy={applying}
                    >
                        {applying ? 'Applying…' : 'Apply changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
