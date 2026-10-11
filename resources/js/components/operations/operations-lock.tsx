import { createContext, useContext } from 'react';

/**
 * Whether the Operations transactions are currently unavailable (browser
 * offline, or the catch-up after reconnecting has not settled). Provided once
 * by the page so every action control can disable itself without prop drilling;
 * the server remains the authority and nothing is queued while locked.
 */
export const OperationsLockContext = createContext(false);

export function useOperationsLocked(): boolean {
    return useContext(OperationsLockContext);
}
