import { useEffect, useState } from 'react';

/**
 * True only after `active` has stayed true for `delayMs`. Fast responses never
 * flash a loading state (loading-state hierarchy: show nothing under 300 ms).
 */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
    const [delayed, setDelayed] = useState(false);

    useEffect(() => {
        if (!active) {
            setDelayed(false);

            return;
        }

        const timer = window.setTimeout(() => setDelayed(true), delayMs);

        return () => window.clearTimeout(timer);
    }, [active, delayMs]);

    return delayed;
}
