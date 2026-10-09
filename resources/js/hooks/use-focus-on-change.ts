import { useEffect, useRef } from 'react';

/**
 * Moves keyboard focus to the returned element when `key` changes, so a step
 * or page change is announced and the next Tab starts at the new content.
 * Give the element `tabIndex={-1}`. With `onMount` it also focuses on first
 * render (for pages reached by navigation); the default leaves the initial
 * render alone so a freshly loaded page keeps the browser's own focus start.
 */
export function useFocusOnChange<T extends HTMLElement>(
    key: unknown,
    { onMount = false }: { onMount?: boolean } = {},
) {
    const element = useRef<T>(null);
    const first = useRef(true);

    useEffect(() => {
        const initial = first.current;
        first.current = false;

        if (initial && !onMount) {
            return;
        }

        element.current?.focus();
    }, [key, onMount]);

    return element;
}
