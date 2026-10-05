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

/** Offset in ms of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    }).formatToParts(new Date(instantMs));
    const get = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
    );

    return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Reads a `datetime-local` value ("2026-10-10T10:00") as wall-clock time in
 * `timeZone` (never the browser's zone) and returns the UTC instant as ISO 8601.
 * Returns '' for an empty or unparsable value.
 */
export function wallTimeToInstant(local: string, timeZone: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
    if (!match) {
        return '';
    }
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    // Two passes settle the offset across a daylight-saving boundary.
    let instant = wall - zoneOffsetMs(wall, timeZone);
    instant = wall - zoneOffsetMs(instant, timeZone);

    return new Date(instant).toISOString();
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
