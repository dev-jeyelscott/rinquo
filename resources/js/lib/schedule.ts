export const WEEKDAYS: readonly { value: number; label: string }[] = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
];

export function weekdayLabel(weekday: number): string {
    return WEEKDAYS.find((day) => day.value === weekday)?.label ?? '';
}

/** "90" -> "1 h 30 min". */
export function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${rest} min`;
    }

    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "13:05" -> "1:05 PM"; returns the input unchanged when it is not HH:MM. */
export function formatClockTime(time: string): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(time);

    if (!match) {
        return time;
    }

    const hours = Number(match[1]);
    const suffix = hours >= 12 ? 'PM' : 'AM';

    return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${suffix}`;
}
