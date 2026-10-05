import { router } from '@inertiajs/react';
import { useState } from 'react';
import { TextareaField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
    /** Visible trigger text, e.g. "Archive". */
    label: string;
    /** Accessible name that says what is affected, e.g. "Archive Full wash". */
    ariaLabel: string;
    title: string;
    description: string;
    confirmLabel: string;
    url: string;
    method?: 'post' | 'put' | 'patch';
    /** When set, the dialog asks for an optional reason (max 500) and posts it as `reason`. */
    reasonLabel?: string;
    reasonRequired?: boolean;
    /** Text of the dismiss button; it must differ from the confirm label. */
    dismissLabel?: string;
    /** Confirm button style: destructive (default) or a neutral primary for non-destructive effects. */
    confirmVariant?: 'destructive' | 'default';
    /** Visible trigger style. */
    triggerVariant?: 'outline' | 'default';
    /** Disables the trigger, for example until a required choice is made. */
    disabled?: boolean;
    /** Extra fields to post; a function is evaluated when the action is confirmed (for example to issue an idempotency key). */
    data?:
        | Record<string, string | number>
        | (() => Record<string, string | number>);
};

/**
 * Confirms a consequential state change (archive, unpublish, decline a request)
 * in a dialog with focus management, then submits it to the server. Records are
 * archived, never deleted, so the wording says what is preserved. An optional
 * reason field covers decisions the Owner may want to explain.
 */
export function ConfirmAction({
    label,
    ariaLabel,
    title,
    description,
    confirmLabel,
    url,
    method = 'post',
    reasonLabel,
    reasonRequired = false,
    dismissLabel = 'Cancel',
    confirmVariant = 'destructive',
    triggerVariant = 'outline',
    disabled = false,
    data = {},
}: Props) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [reason, setReason] = useState('');

    function confirm() {
        router[method](
            url,
            {
                ...(typeof data === 'function' ? data() : data),
                ...(reasonLabel ? { reason: reason.trim() } : {}),
            },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => {
                    setProcessing(false);
                    setOpen(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={triggerVariant}
                    size="sm"
                    aria-label={ariaLabel}
                    disabled={disabled}
                    className="max-sm:h-11"
                >
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {reasonLabel ? (
                    <TextareaField
                        label={reasonLabel}
                        required={reasonRequired}
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                ) : null}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        {dismissLabel}
                    </Button>
                    <Button
                        variant={confirmVariant}
                        onClick={confirm}
                        disabled={
                            processing ||
                            (reasonRequired && reason.trim() === '')
                        }
                        aria-busy={processing}
                    >
                        {processing ? 'Working...' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
