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
}: Props) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [reason, setReason] = useState('');

    function confirm() {
        router[method](
            url,
            reasonLabel && reason.trim() !== ''
                ? { reason: reason.trim() }
                : {},
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
                <Button variant="outline" size="sm" aria-label={ariaLabel}>
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
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                ) : null}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={confirm}
                        disabled={processing}
                        aria-busy={processing}
                    >
                        {processing ? 'Working...' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
