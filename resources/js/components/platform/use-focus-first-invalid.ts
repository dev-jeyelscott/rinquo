import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * After a failed submit, move focus to the first invalid field so assistive technology reads
 * its error description and focus is never left on the document body (the submit button is
 * disabled while the request is in flight). Falls back to the first field when the error is
 * not attached to one. Call `focusFirstInvalid` from the form's `onError`; the focus runs
 * after the errors have rendered.
 */
export function useFocusFirstInvalid<
    T extends HTMLElement = HTMLFormElement,
>() {
    const ref = useRef<T>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (attempt === 0) {
            return;
        }
        const target =
            ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
            ref.current?.querySelector<HTMLElement>('input, textarea, select');
        target?.focus();
    }, [attempt]);

    const focusFirstInvalid = useCallback(
        () => setAttempt((count) => count + 1),
        [],
    );

    return { ref, focusFirstInvalid };
}
