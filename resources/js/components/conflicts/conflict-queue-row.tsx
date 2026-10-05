import { Link } from '@inertiajs/react';
import { StatusChip } from '@/components/owner/status-chip';
import { formatDayAndTime } from '@/lib/booking-format';
import { CAUSE_LABELS, statusLabel } from '@/lib/conflicts';
import { cn } from '@/lib/utils';
import type { ConflictRowData } from '@/types/conflicts';

type Props = {
    row: ConflictRowData;
    href: string;
    selected: boolean;
    timezone: string;
};

/**
 * One scannable conflict in the queue: who, when (the protected original
 * appointment), why, and the state in words as well as colour. The whole row is
 * a link that opens the conflict in the detail pane.
 */
export function ConflictQueueRow({ row, href, selected, timezone }: Props) {
    const status = statusLabel(row);

    return (
        <li>
            <Link
                href={href}
                preserveScroll
                preserveState
                aria-current={selected ? 'true' : undefined}
                className={cn(
                    'grid gap-1 rounded-2xl border p-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none max-sm:min-h-11',
                    selected
                        ? 'border-primary bg-info/10'
                        : 'bg-card hover:bg-accent',
                )}
            >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                        {row.booking?.customerName ?? 'Booking'}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                        {row.booking
                            ? formatDayAndTime(row.booking.startAt, timezone)
                            : ''}
                    </span>
                </span>
                <span className="text-muted-foreground">
                    {row.booking?.serviceName} · {CAUSE_LABELS[row.cause]}
                </span>
                <span>
                    <StatusChip tone={status.tone}>{status.label}</StatusChip>
                </span>
            </Link>
        </li>
    );
}
