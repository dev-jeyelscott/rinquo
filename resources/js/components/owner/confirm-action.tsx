import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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
    /** Disables the trigger and the confirmation, for example until a required choice is made or while offline. */
    disabled?: boolean;
    /** Extra fields to post; a function is evaluated when the action is confirmed (for example to issue an idempotency key). */
    data?:
        | Record<string, string | number>
        | (() => Record<string, string | number>);
    /**
     * When set, a request that never reached a server answer (a network failure) keeps the dialog open with this
     * message instead of closing as if it had settled, so the user can retry the same logical action or refresh.
     */
    networkErrorMessage?: string;
    /** Called when the request has settled, successfully or not (for example to close a surface the action was opened from). */
    onSettled?: () => void;
    /**
     * Where focus goes when the dialog closes after the request settled or while the trigger is disabled or gone;
     * the trigger keeps focus on a plain dismissal, or when this is absent or returns null.
     */
    returnFocus?: () => HTMLElement | null;
    /** Explains inside the open dialog why confirming is unavailable while `disabled` is set. */
    disabledMessage?: string;
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
    networkErrorMessage,
    onSettled,
    returnFocus,
    disabledMessage,
}: Props) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [reason, setReason] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const inFlight = useRef(false);
    const keepOpen = useRef(false);
    const settled = useRef(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const confirmButton = useRef<HTMLButtonElement>(null);
    // The wording is frozen while the dialog is open so a chosen value that the screen later drops cannot blank it.
    const [shown, setShown] = useState(description);

    // Send is disabled while the request is pending, which drops focus to the page body. When an interrupted request
    // leaves the dialog open, put focus back on the (re-enabled) confirm button so Tab continues inside the dialog.
    useEffect(() => {
        if (uncertain && !processing) {
            confirmButton.current?.focus();
        }
    }, [uncertain, processing]);

    function confirm() {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;
        keepOpen.current = false;
        settled.current = false;
        setUncertain(false);
        router[method](
            url,
            {
                ...(typeof data === 'function' ? data() : data),
                ...(reasonLabel ? { reason: reason.trim() } : {}),
            },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onNetworkError: () => {
                    if (networkErrorMessage) {
                        keepOpen.current = true;
                        setUncertain(true);
                    }
                },
                onFinish: () => {
                    inFlight.current = false;
                    setProcessing(false);

                    if (keepOpen.current) {
                        return;
                    }

                    settled.current = true;
                    setOpen(false);
                    onSettled?.();
                },
            },
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                    setShown(description);
                    settled.current = false;
                    setUncertain(false);
                }
            }}
        >
            <DialogTrigger asChild>
                <Button
                    ref={trigger}
                    variant={triggerVariant}
                    size="sm"
                    aria-label={ariaLabel}
                    disabled={disabled}
                    className="max-sm:h-11"
                >
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    const lost =
                        settled.current ||
                        !trigger.current?.isConnected ||
                        trigger.current.disabled;
                    const target = lost ? returnFocus?.() : null;

                    if (target) {
                        event.preventDefault();
                        target.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {open ? shown : description}
                    </DialogDescription>
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
                {uncertain && networkErrorMessage ? (
                    <p role="alert" className="text-sm font-semibold">
                        {networkErrorMessage}
                    </p>
                ) : null}
                {disabled && disabledMessage ? (
                    <p role="alert" className="text-sm font-semibold">
                        {disabledMessage}
                    </p>
                ) : null}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        {dismissLabel}
                    </Button>
                    <Button
                        ref={confirmButton}
                        variant={confirmVariant}
                        onClick={confirm}
                        disabled={
                            processing ||
                            disabled ||
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
