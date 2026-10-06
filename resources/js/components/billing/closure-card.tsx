import { useForm } from '@inertiajs/react';
import { LockIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { SectionCard } from '@/components/owner/section-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { formatDate } from '@/lib/billing';
import { ALERT_TONES } from '@/lib/tones';
import type { BillingUrls } from '@/types/billing';
import type { Entitlement } from '@/types/owner';

type Props = {
    organizationName: string;
    entitlement: Entitlement;
    urls: BillingUrls;
    recoveryDays: number;
    timezone: string;
};

const PRESERVED =
    'Bookings, customers, staff accounts, photos and your configuration are kept exactly as they are.';

/**
 * Explicit organization closure, deliberately separate from billing. Not
 * renewing never closes anything; only this action starts the recovery window.
 * Closing needs a typed confirmation in a focused dialog, and the closed
 * states say exactly what is preserved and until when it can be recovered.
 */
export function ClosureCard({
    organizationName,
    entitlement,
    urls,
    recoveryDays,
    timezone,
}: Props) {
    const closure = entitlement.closure;

    if (closure === null) {
        return (
            <SectionCard
                title="Close organization"
                description="Closing is a deliberate decision and is not the same as letting your subscription lapse."
                className="border-destructive/40"
            >
                <div className="grid gap-4">
                    <p className="max-w-[65ch] text-sm text-muted-foreground">
                        If you simply stop paying, your shop is restricted but
                        nothing is ever closed or deleted. Closing stops new
                        bookings and configuration changes right away. Existing
                        bookings stay open for staff and customers. You can
                        recover the organization for {recoveryDays} days.
                    </p>
                    <CloseDialog
                        organizationName={organizationName}
                        url={urls.closure}
                        recoveryDays={recoveryDays}
                    />
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard
            title="Organization closed"
            description="You requested this closure."
        >
            <div className="grid gap-4">
                {closure.state === 'recoverable' ? (
                    <>
                        <Alert className={ALERT_TONES.warning} role="status">
                            <LockIcon aria-hidden="true" />
                            <AlertTitle>
                                Recoverable until{' '}
                                {formatDate(closure.recoverableUntil, timezone)}
                            </AlertTitle>
                            <AlertDescription>
                                <p className="max-w-[65ch]">
                                    Closed on{' '}
                                    {formatDate(closure.requestedAt, timezone)}.
                                    New bookings and configuration changes are
                                    stopped. {PRESERVED} Recovering returns
                                    access to whatever your subscription
                                    currently allows.
                                </p>
                            </AlertDescription>
                        </Alert>
                        <RecoverButton url={urls.recover} />
                    </>
                ) : (
                    <Alert className={ALERT_TONES.error} role="status">
                        <LockIcon aria-hidden="true" />
                        <AlertTitle>The recovery window ended</AlertTitle>
                        <AlertDescription>
                            <p className="max-w-[65ch]">
                                It ended on{' '}
                                {formatDate(closure.recoverableUntil, timezone)}
                                . Rinquo Platform Operations now handles
                                retention. Nothing has been deleted
                                automatically, and existing bookings stay open.
                            </p>
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </SectionCard>
    );
}

function CloseDialog({
    organizationName,
    url,
    recoveryDays,
}: {
    organizationName: string;
    url: string;
    recoveryDays: number;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({ confirmation: '' });
    const matches = form.data.confirmation.trim() === organizationName;
    const errors = form.errors as Record<string, string | undefined>;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" className="w-fit max-sm:h-11">
                    Close organization
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>Close {organizationName}?</DialogTitle>
                        <DialogDescription>
                            New bookings and configuration changes stop
                            immediately. Existing bookings stay open. You can
                            recover the organization for {recoveryDays} days;
                            after that, Rinquo Platform Operations decides about
                            retention.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.closure ? (
                        <Alert className={ALERT_TONES.error} role="alert">
                            <AlertDescription>
                                <p>{errors.closure}</p>
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <TextField
                        label={`Type "${organizationName}" to confirm`}
                        value={form.data.confirmation}
                        onChange={(event) =>
                            form.setData('confirmation', event.target.value)
                        }
                        error={errors.confirmation}
                        autoComplete="off"
                        required
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Keep organization open
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={!matches || form.processing}
                            aria-busy={form.processing}
                        >
                            {form.processing ? (
                                <>
                                    <Spinner aria-hidden="true" /> Closing...
                                </>
                            ) : (
                                'Close organization'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RecoverButton({ url }: { url: string }) {
    const form = useForm({});
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <div className="grid gap-2">
            {errors.closure ? (
                <Alert className={ALERT_TONES.error} role="alert">
                    <AlertDescription>
                        <p>{errors.closure}</p>
                    </AlertDescription>
                </Alert>
            ) : null}
            <Button
                className="w-fit max-sm:h-11"
                disabled={form.processing}
                aria-busy={form.processing}
                onClick={() => form.post(url, { preserveScroll: true })}
            >
                {form.processing ? (
                    <>
                        <Spinner aria-hidden="true" /> Recovering...
                    </>
                ) : (
                    'Recover organization'
                )}
            </Button>
        </div>
    );
}
