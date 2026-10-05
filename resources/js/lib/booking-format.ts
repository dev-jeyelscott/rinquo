import { formatInstant } from '@/lib/datetime';

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
};

/** "2026-10-06" -> "Tue, Oct 6". A calendar date has no timezone, so it is read as UTC noon. */
export function formatLocalDate(
    date: string,
    options: Intl.DateTimeFormatOptions = DAY_FORMAT,
): string {
    return new Intl.DateTimeFormat('en-PH', {
        ...options,
        timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
}

/** "9:00 AM" in the branch timezone. */
export function formatTime(startAt: string, timeZone: string): string {
    return formatInstant(startAt, timeZone, {
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** "Tue, Oct 6, 9:00 AM" in the branch timezone. */
export function formatDayAndTime(startAt: string, timeZone: string): string {
    return formatInstant(startAt, timeZone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** The branch-local calendar date (YYYY-MM-DD) of an instant. */
export function localDateOf(startAt: string, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(startAt));
}

/** "mm:ss" for a countdown in seconds. */
export function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));

    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** An RFC 4122 v4 id, from crypto.randomUUID when available. */
export function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);

        return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
}
