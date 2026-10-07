import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Spinner } from '@/components/ui/spinner';

type Data = Record<string, string | number>;

type Props = {
    /** Visible trigger text. */
    label: string;
    /** Accessible name that says what is affected. */
    ariaLabel?: string;
    title: string;
    /** What will happen, including whether it can be undone. */
    description: string;
    confirmLabel: string;
    pendingLabel: string;
    url: string;
    /** Fields posted with the action besides the step-up. */
    initial?: Data;
    /** Extra inputs for this action, rendered above the step-up fields. */
    children?: (form: StepUpForm) => ReactNode;
    triggerVariant?: 'outline' | 'default' | 'destructive';
    confirmVariant?: 'default' | 'destructive';
    triggerClassName?: string;
};

export type StepUpForm = {
    data: Data;
    setData: (key: string, value: string | number) => void;
    errors: Record<string, string>;
};

/**
 * Sensitive platform actions re-authenticate at the moment of action: the admin re-enters
 * their password and a fresh authenticator code, and the server verifies both in the same
 * request. Nothing is optimistic: the dialog stays open and shows the server's answer until
 * the request settles, and the confirm button is disabled while it is in flight.
 */
export function StepUpDialog({
    label,
    ariaLabel,
    title,
    description,
    confirmLabel,
    pendingLabel,
    url,
    initial = {},
    children,
    triggerVariant = 'outline',
    confirmVariant = 'default',
    triggerClassName,
}: Props) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={triggerVariant}
                    size="sm"
                    aria-label={ariaLabel}
                    className={triggerClassName ?? 'max-sm:h-11'}
                >
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <StepUpBody
                    {...{
                        title,
                        description,
                        confirmLabel,
                        pendingLabel,
                        url,
                        initial,
                        children,
                        confirmVariant,
                    }}
                    onDone={() => setOpen(false)}
                    onCancel={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function StepUpBody({
    title,
    description,
    confirmLabel,
    pendingLabel,
    url,
    initial,
    children,
    confirmVariant,
    onDone,
    onCancel,
}: Pick<
    Props,
    | 'title'
    | 'description'
    | 'confirmLabel'
    | 'pendingLabel'
    | 'url'
    | 'children'
> & {
    initial: Data;
    confirmVariant: 'default' | 'destructive';
    onDone: () => void;
    onCancel: () => void;
}) {
    const form = useForm<Data & { current_password: string; otp_code: string }>(
        {
            ...initial,
            current_password: '',
            otp_code: '',
        },
    );
    const [networkError, setNetworkError] = useState(false);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        setNetworkError(false);
        form.post(url, {
            preserveScroll: true,
            onSuccess: onDone,
            onNetworkError: () => setNetworkError(true),
            // The one-time code and password are never kept after an attempt.
            onFinish: () => form.reset('current_password', 'otp_code'),
        });
    }

    const errors = form.errors as Record<string, string>;
    const general = errors.job ?? errors.admin ?? errors.token;

    return (
        <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {children?.({
                data: form.data,
                setData: (key, value) => form.setData(key, value),
                errors,
            })}
            <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">
                    Confirm it is you
                </legend>
                <TextField
                    label="Password"
                    type="password"
                    name="current_password"
                    autoComplete="current-password"
                    required
                    value={form.data.current_password}
                    onChange={(event) =>
                        form.setData('current_password', event.target.value)
                    }
                    error={errors.current_password}
                />
                <TextField
                    label="Authenticator code"
                    name="otp_code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={form.data.otp_code}
                    onChange={(event) =>
                        form.setData(
                            'otp_code',
                            event.target.value.replace(/\D/g, ''),
                        )
                    }
                    error={errors.otp_code}
                />
            </fieldset>
            {general ? (
                <Alert variant="destructive">
                    <AlertDescription>{general}</AlertDescription>
                </Alert>
            ) : null}
            {networkError ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        You appear to be offline. Nothing was changed. Check
                        your connection and try again.
                    </AlertDescription>
                </Alert>
            ) : null}
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant={confirmVariant}
                    disabled={
                        form.processing ||
                        form.data.current_password === '' ||
                        form.data.otp_code.length !== 6
                    }
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {form.processing ? pendingLabel : confirmLabel}
                </Button>
            </DialogFooter>
        </form>
    );
}
