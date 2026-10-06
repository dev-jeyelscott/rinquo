import { formatInstant } from '@/lib/datetime';
import type { EntitlementState } from '@/types/owner';

export const STATE_LABEL: Record<EntitlementState, string> = {
    trial: 'Free trial',
    paid: 'Paid',
    grace: 'Grace period',
    restricted: 'Restricted',
};

export const STATE_TONE: Record<
    EntitlementState,
    'info' | 'success' | 'warning' | 'neutral'
> = {
    trial: 'info',
    paid: 'success',
    grace: 'warning',
    restricted: 'warning',
};

/** Long date and time in the display timezone, e.g. "Nov 20, 2026, 8:00 AM". */
export function formatDateTime(iso: string, timeZone: string): string {
    return formatInstant(iso, timeZone);
}

/** Date only, for deadlines people plan around. */
export function formatDate(iso: string, timeZone: string): string {
    return formatInstant(iso, timeZone, { dateStyle: 'long' });
}

/** The instant access ends before grace: the later of the trial end and paid-through date. */
export function accessEndsAt(
    trialEndsAt: string | null,
    paidUntil: string | null,
): string | null {
    if (trialEndsAt === null) {
        return paidUntil;
    }

    return paidUntil !== null &&
        new Date(paidUntil).getTime() > new Date(trialEndsAt).getTime()
        ? paidUntil
        : trialEndsAt;
}

/** "m:ss" for a countdown in whole seconds, never negative. */
export function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
