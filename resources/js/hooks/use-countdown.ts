import { useEffect, useState } from 'react';

/**
 * Counts down whole seconds to zero. Restarts whenever `seconds` changes
 * (for example after a resend), and stops its timer at zero.
 */
export function useCountdown(seconds: number): number {
    const [remaining, setRemaining] = useState(seconds);

    useEffect(() => {
        setRemaining(seconds);

        if (seconds <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setRemaining((current) => {
                if (current <= 1) {
                    window.clearInterval(timer);

                    return 0;
                }

                return current - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [seconds]);

    return remaining;
}
