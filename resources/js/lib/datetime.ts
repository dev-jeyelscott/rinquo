const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
};

/**
 * Formats an absolute instant (ISO 8601 with offset, normally UTC from the
 * server) as wall-clock time in the given display timezone.
 *
 * Throws a RangeError when the value is not a valid instant, so callers
 * never render "Invalid Date".
 */
export function formatInstant(
    isoInstant: string,
    timeZone: string,
    options: Intl.DateTimeFormatOptions = defaultOptions,
    locale = 'en-PH',
): string {
    const instant = new Date(isoInstant);

    if (Number.isNaN(instant.getTime())) {
        throw new RangeError(`Invalid instant: ${isoInstant}`);
    }

    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
        instant,
    );
}
