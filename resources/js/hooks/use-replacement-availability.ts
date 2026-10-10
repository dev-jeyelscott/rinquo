import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import type { SelectorStatus } from '@/components/booking/exact-start-time-selector';
import { useOnline } from '@/hooks/use-online';
import { localDateOf } from '@/lib/booking-format';
import type {
    BookingDate,
    DayAvailability,
    NextAvailable,
} from '@/types/booking';

type Options = {
    /** The booking page URL the availability partial reloads target. */
    url: string;
    timezone: string;
    enabled: boolean;
    dates: BookingDate[] | null | undefined;
    availability: DayAvailability | null | undefined;
    next: NextAvailable | undefined;
};

/**
 * Date, time and load state of the replacement picker. The server authors
 * every offered time (for the booked service terms); this hook only asks for a
 * date through a partial reload, keeps the choice while it loads, and reports
 * loading, offline and failure for the selector. A chosen time that a later
 * reload no longer offers is dropped and reported through `lost`, because a
 * displayed time is never a reservation.
 */
export function useReplacementAvailability({
    url,
    timezone,
    enabled,
    dates,
    availability,
    next,
}: Options) {
    const online = useOnline();
    // A deep-linked date opens first: the server already answered for it.
    const [date, setDate] = useState<string | null>(
        () => availability?.date ?? null,
    );
    const [startAt, setStartAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<'error' | 'offline' | null>(null);
    const [lost, setLost] = useState(false);

    const load = useCallback(
        (target: string) => {
            if (!navigator.onLine) {
                setFailure('offline');

                return;
            }
            setFailure(null);
            router.get(
                url,
                { date: target },
                {
                    only: ['replacementAvailability', 'replacementNext'],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onStart: () => setLoading(true),
                    onError: () => setFailure('error'),
                    onNetworkError: () => setFailure('offline'),
                    onHttpException: () => {
                        setFailure('error');

                        return false;
                    },
                    onFinish: () => setLoading(false),
                },
            );
        },
        [url],
    );

    // Open on the date of the next available time (else the first open date).
    const firstOpen = dates?.find((day) => !day.closed)?.date ?? null;
    const opening = next ? localDateOf(next.startAt, timezone) : firstOpen;
    useEffect(() => {
        if (enabled && date === null && opening) {
            setDate(opening);
            // With nothing bookable anywhere there is no day worth loading.
            if (next !== null && availability?.date !== opening) {
                load(opening);
            }
        }
    }, [enabled, date, opening, availability?.date, next, load]);

    // A time that is no longer offered after a reload is dropped from the selection.
    useEffect(() => {
        if (
            startAt &&
            availability &&
            availability.date === localDateOf(startAt, timezone) &&
            !availability.times.some(
                (slot) => slot.startAt === startAt && slot.available,
            )
        ) {
            setStartAt(null);
            setLost(true);
        }
    }, [availability, startAt, timezone]);

    const changeDate = (target: string) => {
        setDate(target);
        setStartAt(null);
        setLost(false);
        load(target);
    };
    const select = (value: string | null) => {
        setStartAt(value);
        setLost(false);
    };
    const jumpToNext = () => {
        if (!next) {
            return;
        }
        const target = localDateOf(next.startAt, timezone);
        setDate(target);
        setStartAt(next.startAt);
        setLost(false);
        if (target !== availability?.date) {
            load(target);
        }
    };
    const retry = () => {
        const target = date ?? opening;
        if (target) {
            load(target);
        }
    };
    /** Drops the chosen time and refreshes the day (for example after the server refused it). */
    const refreshDay = () => {
        setStartAt(null);
        retry();
    };

    const status: SelectorStatus = !online
        ? 'offline'
        : (failure ?? (loading ? 'loading' : 'ready'));

    return {
        date,
        startAt,
        status,
        lost,
        online,
        changeDate,
        select,
        jumpToNext,
        retry,
        refreshDay,
    };
}
