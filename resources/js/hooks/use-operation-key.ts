import { useRef } from 'react';
import { uuid } from '@/lib/booking-format';

/**
 * Returns a function that issues an idempotency key when an action is
 * triggered. The key stays the same while `version` (for example the booking's
 * revision and state) is unchanged, so a repeated click replays one operation on
 * the server, and is replaced as soon as the version changes, so a changed
 * booking can never reuse an old key. Keys are issued in event handlers, never
 * during render.
 */
export function useOperationKey(version: string): () => string {
    const issued = useRef<{ version: string; key: string } | null>(null);

    return () => {
        if (issued.current?.version !== version) {
            issued.current = { version, key: uuid() };
        }

        return issued.current.key;
    };
}
