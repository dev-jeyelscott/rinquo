import type { ConflictCause, ConflictRowData } from '@/types/conflicts';

/** Short, plain-language reason a booking cannot be fulfilled as scheduled. */
export const CAUSE_LABELS: Record<ConflictCause, string> = {
    resource_blocked: 'The resource is blocked',
    resource_unavailable: 'The resource is no longer available',
    compatibility: 'The resource is no longer compatible with this service',
    capacity: 'The resource no longer has enough capacity',
    hours: 'The time is outside the new hours or service window',
};

/** The headline sentence for a conflict, naming the resource when that is the cause. */
export function causeSentence(row: ConflictRowData): string {
    const resource = row.originalResource ?? 'The assigned resource';

    switch (row.cause) {
        case 'resource_blocked':
            return `${resource} is blocked during this appointment.`;
        case 'resource_unavailable':
            return `${resource} is no longer available.`;
        case 'compatibility':
            return `${resource} is no longer compatible with this service.`;
        case 'capacity':
            return `${resource} no longer has capacity at this time.`;
        case 'hours':
            return 'This appointment is now outside business hours or the service window.';
    }
}

/** A conflict's state in words, for chips and queue rows. */
export function statusLabel(row: ConflictRowData): {
    label: string;
    tone: 'warning' | 'info' | 'success' | 'neutral';
} {
    if (row.status === 'resolved') {
        return row.resolution === 'same_time_reassigned'
            ? { label: 'Moved at the same time', tone: 'success' }
            : row.resolution === 'customer_accepted'
              ? { label: 'Customer accepted', tone: 'success' }
              : { label: 'Booking closed', tone: 'neutral' };
    }
    if (row.status === 'awaiting_customer') {
        return { label: 'Awaiting reply', tone: 'warning' };
    }
    if (
        row.lastOutcome?.status === 'declined' ||
        row.lastOutcome?.status === 'expired'
    ) {
        return {
            label:
                row.lastOutcome.status === 'declined'
                    ? 'Declined, needs staff'
                    : 'Expired, needs staff',
            tone: 'warning',
        };
    }

    return { label: 'Needs proposal', tone: 'warning' };
}

/** Whole minutes (never negative) until an instant, for "expires in 28 min". */
export function minutesUntil(instant: string, now: number): number {
    return Math.max(0, Math.ceil((new Date(instant).getTime() - now) / 60000));
}

/** "28 min" or "1 h 5 min" for a deadline countdown. */
export function formatMinutes(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
