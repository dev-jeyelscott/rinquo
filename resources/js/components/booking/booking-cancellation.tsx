import { TriangleAlertIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { useOnline } from '@/hooks/use-online';
import type { BookingManagement } from '@/hooks/use-booking-management';
import { formatLongDayAndTime, formatTime } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';

type Props = {
    form: BookingManagement['cancellation'];
    url: string;
    shopName: string;
    startAt: string;
    timezone: string;
    /** The last moment for a self-service change; named in the policy note when known. */
    deadlineAt: string | null;
    /** Leaves the cancellation view without changing anything. */
    onKeep: () => void;
    /** Moves focus to the outcome once the booking is cancelled (the trigger disappears with it). */
    onCancelled: () => void;
};

/** Page-local form boundary: the field token is near-white, so the control takes a visible border (WCAG 1.4.11). */
const FIELD_BORDER = 'border border-muted-foreground bg-background';

/**
 * Cancellation (Spec 03 cancel references) as its own staged view: the policy
 * in words, an optional reason, then one deliberate review in a focused dialog
 * that names exactly what is cancelled and states that the booking stays as it
 * is until the cancellation succeeds. The destructive button keeps its
 * geometry while pending and ignores a second activation; server idempotency
 * protects the request itself. Every rejection (cutoff, stale revision, spent
 * key, offline) is written out and announced.
 */
export function BookingCancellation({
    form,
    url,
    shopName,
    startAt,
    timezone,
    deadlineAt,
    onKeep,
    onCancelled,
}: Props) {
    const [open, setOpen] = useState(false);
    const [network, setNetwork] = useState(false);
    const cancelled = useRef(false);
    const online = useOnline();
    const heading = useFocusOnChange<HTMLHeadingElement>('cancel', {
        onMount: true,
    });
    const message =
        form.errors.booking ??
        form.errors.reason ??
        form.errors.idempotency_key;

    const submit = () => {
        if (form.processing) {
            return;
        }
        setNetwork(false);
        let unreachable = false;
        form.post(url, {
            onSuccess: () => {
                cancelled.current = true;
            },
            // Stay in the review so the offline note is read next to the retry.
            onNetworkError: () => {
                unreachable = true;
                setNetwork(true);
            },
            onFinish: () => {
                if (!unreachable) {
                    setOpen(false);
                }
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <section
                aria-labelledby="manage-booking-heading"
                className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
            >
                <div className="grid gap-1">
                    <h2
                        id="manage-booking-heading"
                        ref={heading}
                        tabIndex={-1}
                        className="text-lg font-semibold outline-none"
                    >
                        Cancel this booking?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Please review the cancellation policy before continuing.
                    </p>
                </div>
                <Alert role={undefined} className={ALERT_TONES.warning}>
                    <TriangleAlertIcon aria-hidden="true" />
                    <AlertTitle>
                        {deadlineAt
                            ? `Free self-service cancellation until ${formatTime(deadlineAt, timezone)}`
                            : 'Cancellation is available until the change deadline'}
                    </AlertTitle>
                    <AlertDescription>
                        After the change deadline, please contact the shop.
                        Cancellation cannot be undone.
                    </AlertDescription>
                </Alert>
                <label
                    className="grid gap-1.5 text-sm font-semibold"
                    htmlFor="cancellation-reason"
                >
                    <span>
                        Reason for cancelling{' '}
                        <span className="font-normal text-muted-foreground">
                            (optional)
                        </span>
                    </span>
                    <textarea
                        id="cancellation-reason"
                        value={form.data.reason}
                        maxLength={500}
                        placeholder="e.g. Change of plans"
                        aria-invalid={message ? true : undefined}
                        aria-describedby={
                            message
                                ? 'cancellation-error cancellation-hint'
                                : 'cancellation-hint'
                        }
                        onChange={(event) =>
                            form.setData('reason', event.target.value)
                        }
                        className={cn(
                            FIELD_BORDER,
                            'min-h-28 rounded-md px-3 py-2 font-normal',
                        )}
                    />
                    <span
                        id="cancellation-hint"
                        className="text-xs font-normal text-muted-foreground"
                    >
                        Optional · up to 500 characters
                    </span>
                </label>
                {message ? (
                    <p
                        id="cancellation-error"
                        role="alert"
                        className="text-sm text-destructive"
                    >
                        {message}
                    </p>
                ) : null}
                <BookingActionBar
                    label="Cancellation actions"
                    back={{ onClick: onKeep, label: 'Keep booking' }}
                >
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            aria-disabled={form.processing || undefined}
                            className={buttonVariants()}
                        >
                            {form.processing
                                ? 'Cancelling…'
                                : 'Review cancellation'}
                        </button>
                    </DialogTrigger>
                </BookingActionBar>
            </section>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    // The trigger disappears once the booking is cancelled: land on the outcome instead.
                    if (cancelled.current) {
                        event.preventDefault();
                        cancelled.current = false;
                        onCancelled();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Cancel this booking?</DialogTitle>
                    <DialogDescription>
                        You&apos;re cancelling{' '}
                        <strong className="font-semibold text-foreground">
                            {formatLongDayAndTime(startAt, timezone).replace(
                                ' · ',
                                ' at ',
                            )}
                        </strong>{' '}
                        at {shopName} (Philippine time).
                    </DialogDescription>
                </DialogHeader>
                <Alert role={undefined} className={ALERT_TONES.error}>
                    <TriangleAlertIcon aria-hidden="true" />
                    <AlertTitle>This cannot be undone</AlertTitle>
                    <AlertDescription>
                        If you confirm, the reserved appointment is cancelled
                        and the time is released after the request succeeds.
                        Your booking stays as it is until then.
                    </AlertDescription>
                </Alert>
                {!online || network ? (
                    <Alert role="alert" className={ALERT_TONES.warning}>
                        <AlertTitle>
                            {online
                                ? 'We could not reach the shop'
                                : 'You appear to be offline'}
                        </AlertTitle>
                        <AlertDescription>
                            Nothing was changed. Your booking is still reserved.
                            Try again when you are connected.
                        </AlertDescription>
                    </Alert>
                ) : null}
                <DialogFooter>
                    <button
                        type="button"
                        className={cn(
                            buttonVariants({ variant: 'outline' }),
                            'max-sm:h-11',
                        )}
                        onClick={() => setOpen(false)}
                    >
                        Keep booking
                    </button>
                    <button
                        type="button"
                        aria-disabled={form.processing || !online || undefined}
                        onClick={() => online && submit()}
                        className={cn(
                            buttonVariants({ variant: 'destructive' }),
                            'max-sm:h-11',
                            (form.processing || !online) &&
                                'pointer-events-none opacity-50',
                        )}
                    >
                        {form.processing ? 'Cancelling…' : 'Cancel booking'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
