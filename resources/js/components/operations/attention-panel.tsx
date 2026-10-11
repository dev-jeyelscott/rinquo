import { useRef } from 'react';
import { useOperationsLocked } from '@/components/operations/operations-lock';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { StatusChip } from '@/components/owner/status-chip';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { AttentionItemData } from '@/types/operations';

type Props = {
    items: AttentionItemData[];
    /** Whole-result count of open failures (the list itself is paged). */
    total: number;
    /** In-service work projected past its planned finish. */
    delayed: number;
    url: string;
};

/**
 * What needs a person (Spec 04 references 01, 14 and 15): permanently failed
 * customer emails with a once-only retry, and service overruns. A retry never
 * changes a booking or its queue position, the failure stays visible until it
 * is delivered, and the retry is disabled while the board is offline. The list
 * is paged by the parent so no failure is hidden.
 */
export function AttentionPanel({ items, total, delayed, url }: Props) {
    const locked = useOperationsLocked();
    const heading = useRef<HTMLHeadingElement>(null);

    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-3 px-5">
                <h2
                    ref={heading}
                    tabIndex={-1}
                    className="text-xl font-semibold outline-none"
                >
                    Attention needed
                </h2>
                {total === 0 && delayed === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No failed emails and no overruns. Bookings and walk-ins
                        are unaffected either way.
                    </p>
                ) : null}
                {delayed > 0 ? (
                    <div className="grid gap-0.5 rounded-xl border border-warning/40 bg-warning/10 p-3">
                        <p className="text-sm font-semibold text-warning-text">
                            {delayed} operational{' '}
                            {delayed === 1 ? 'overrun' : 'overruns'}
                        </p>
                        <p className="text-sm">
                            Estimated finish may be delayed. The bay stays
                            occupied until the work is completed.
                        </p>
                    </div>
                ) : null}
                {items.length > 0 ? (
                    <ul
                        aria-label="Failed notifications"
                        className="grid gap-2"
                    >
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
                            >
                                <p className="font-semibold text-foreground">
                                    Email delivery failed
                                </p>
                                <p className="text-sm">
                                    {item.label} for {item.customerName}. The
                                    booking itself is saved, and retrying does
                                    not change it or its queue position.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusChip tone="warning">
                                        {item.status === 'retrying'
                                            ? 'Retrying'
                                            : 'Failed'}
                                    </StatusChip>
                                    {item.retryCount > 0 ? (
                                        <span className="text-xs text-foreground tabular-nums">
                                            {item.retryCount} retry
                                        </span>
                                    ) : null}
                                    {item.status === 'retrying' ? (
                                        <span
                                            role="status"
                                            className="flex items-center gap-1 text-sm"
                                        >
                                            <Spinner
                                                role="presentation"
                                                aria-hidden="true"
                                            />
                                            Retrying…
                                        </span>
                                    ) : (
                                        <ConfirmAction
                                            label="Retry"
                                            ariaLabel={`Retry the ${item.label} email for ${item.customerName}`}
                                            title={`Retry the ${item.label} email?`}
                                            description={`The email to ${item.customerName} is sent again once. The retry is recorded.`}
                                            confirmLabel="Retry email"
                                            confirmVariant="default"
                                            disabled={locked}
                                            // The Retry control is replaced by the retrying status, so focus moves to the section heading.
                                            returnFocus={() => heading.current}
                                            url={`${url}/${item.id}/retry`}
                                        />
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </CardContent>
        </Card>
    );
}
