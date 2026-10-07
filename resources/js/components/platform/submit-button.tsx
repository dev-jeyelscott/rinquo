import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** A submit control that names the pending action and keeps its geometry (no layout shift). */
export function SubmitButton({
    processing,
    label,
    pendingLabel,
    ...props
}: Omit<ComponentProps<typeof Button>, 'type' | 'children'> & {
    processing: boolean;
    label: string;
    pendingLabel: string;
}) {
    return (
        <Button
            type="submit"
            className="max-sm:h-11"
            {...props}
            disabled={processing || props.disabled}
            aria-busy={processing}
        >
            {processing ? (
                <Spinner role="presentation" aria-hidden="true" />
            ) : null}
            {processing ? pendingLabel : label}
        </Button>
    );
}
