import { useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ALERT_TONES } from '@/lib/tones';

/**
 * After a rejected submit, moves focus to the first invalid field, or to the
 * form-level error when no field is at fault, so the failure is announced and
 * the next Tab continues from it. Call `failed` from the submit's `onError`
 * and attach `form` and `alert` to the form and the form-level error.
 */
export function useSubmitFailureFocus() {
    const form = useRef<HTMLFormElement>(null);
    const alert = useRef<HTMLDivElement>(null);
    const [failures, setFailures] = useState(0);

    useEffect(() => {
        if (failures === 0) {
            return;
        }
        // A disabled control cannot take focus, so it falls back to the alert.
        const invalid = form.current?.querySelector<HTMLElement>(
            '[aria-invalid="true"]:not(:disabled)',
        );
        (invalid ?? alert.current)?.focus();
    }, [failures]);

    return { form, alert, failed: () => setFailures((count) => count + 1) };
}

type Props = {
    /** A form-level rejection (not tied to one field), shown beside the action. */
    error?: string | null;
    alertRef: Ref<HTMLDivElement>;
    children: ReactNode;
};

/**
 * Sheet form footer that stays in view while the fields scroll: the primary
 * action is always reachable and a form-level rejection appears next to it
 * instead of off-screen above the fields.
 */
export function SheetFormFooter({ error, alertRef, children }: Props) {
    return (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 grid gap-3 border-t bg-background p-4">
            {error ? (
                <Alert
                    ref={alertRef}
                    tabIndex={-1}
                    className={ALERT_TONES.error}
                    role="alert"
                >
                    <AlertDescription>
                        <p>{error}</p>
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">{children}</div>
        </div>
    );
}
