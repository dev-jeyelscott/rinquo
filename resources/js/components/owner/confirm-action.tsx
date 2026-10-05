import { router } from '@inertiajs/react';
import { useState } from 'react';
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
};

/**
 * Confirms a consequential, non-destructive state change (archive, unpublish)
 * in a dialog with focus management, then submits it to the server. Records are
 * archived, never deleted, so the wording says what is preserved.
 */
export function ConfirmAction({
    label,
    ariaLabel,
    title,
    description,
    confirmLabel,
    url,
    method = 'post',
}: Props) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    function confirm() {
        router[method](
            url,
            {},
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
