import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Moves focus to the first field marked `aria-invalid` when a submit comes back
 * with errors. The submit button is disabled while the request runs, which
 * drops focus to the page body; this restores it on the field whose
 * `aria-describedby` message explains the failure.
 */
export function useFocusFirstInvalid(
    form: RefObject<HTMLFormElement | null>,
    errors: Record<string, string | undefined>,
): void {
    const hasErrors = Object.values(errors).some(Boolean);

    useEffect(() => {
        if (hasErrors) {
            form.current
                ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus();
        }
    }, [errors, form, hasErrors]);
}
