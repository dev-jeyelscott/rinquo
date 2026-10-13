import { Link } from '@inertiajs/react';
import { CircleAlertIcon, LockIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { formatDate } from '@/lib/billing';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { Entitlement } from '@/types/owner';

type Props = {
    entitlement: Entitlement;
    billingUrl: string;
    /**
     * True on the billing page itself: the page renders its own banner there (the shell does not),
     * so the recovery action is already in view and the copy names the Billing context.
     */
    onBilling: boolean;
    timezone: string;
};

/**
 * Persistent, specific notice when the organization is in grace, restricted or
 * closed. It names what still works (existing bookings and Operations) and
 * makes the recovery destination the one action; restriction is not an outage.
 */
export function EntitlementBanner({
    entitlement,
    billingUrl,
    onBilling,
    timezone,
}: Props) {
    if (entitlement.closed && entitlement.closure) {
        const deadline = formatDate(
            entitlement.closure.recoverableUntil,
            timezone,
        );

        return (
            <Banner
                tone="error"
                title="This organization is closed"
                billingUrl={billingUrl}
                onBilling={onBilling}
                action="Review closure"
            >
                {entitlement.closure.state === 'recoverable'
                    ? `New bookings and configuration changes are stopped. Existing bookings stay open for staff and customers. You can recover the organization until ${deadline}.`
                    : `The recovery window ended on ${deadline}. Existing bookings stay open; Rinquo Platform Operations handles what happens next.`}
            </Banner>
        );
    }

    if (entitlement.state === 'restricted') {
        const trialEnded =
            entitlement.paidUntil === null
                ? `Your free trial ended on ${formatDate(entitlement.trialEndsAt ?? '', timezone)}. `
                : '';

        return onBilling ? (
            <Banner
                tone="error"
                title="Subscription restricted"
                billingUrl={billingUrl}
                onBilling={onBilling}
                action="Renew now"
            >
                {trialEnded}New bookings and configuration writes are paused.
                Billing remains available. Existing bookings can still be
                operated and completed, and nothing is deleted.
            </Banner>
        ) : (
            <Banner
                tone="warning"
                title="New bookings paused"
                billingUrl={billingUrl}
                onBilling={onBilling}
                action="Renew now"
            >
                {trialEnded}Continue checking in, servicing and completing
                existing bookings. New bookings and configuration changes are
                paused, customer cancellations still work, and nothing is
                deleted. Renewing restores everything as soon as the payment is
                confirmed.
            </Banner>
        );
    }

    if (entitlement.state === 'grace' && entitlement.graceEndsAt) {
        return (
            <Banner
                tone="warning"
                title="Paid period ended: grace active"
                billingUrl={billingUrl}
                onBilling={onBilling}
                action="Renew now"
            >
                Your existing operations and new bookings work until the grace
                deadline. New bookings and configuration changes stop on{' '}
                <span className="tabular-nums">
                    {formatDate(entitlement.graceEndsAt, timezone)}
                </span>
                . Existing bookings are never affected.
            </Banner>
        );
    }

    return null;
}

function Banner({
    tone,
    title,
    action,
    billingUrl,
    onBilling,
    children,
}: {
    tone: 'warning' | 'error';
    title: string;
    action: string;
    billingUrl: string;
    onBilling: boolean;
    children: React.ReactNode;
}) {
    const Icon = tone === 'error' ? LockIcon : CircleAlertIcon;

    return (
        <Alert className={cn(ALERT_TONES[tone], 'mb-4')} role="status">
            <Icon aria-hidden="true" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>
                <p className="max-w-[65ch]">{children}</p>
                {onBilling ? null : (
                    <Link
                        href={billingUrl}
                        className={cn(
                            buttonVariants({
                                variant:
                                    tone === 'error' ? 'outline' : 'default',
                            }),
                            'mt-2 w-fit max-sm:h-11',
                        )}
                    >
                        {action}
                    </Link>
                )}
            </AlertDescription>
        </Alert>
    );
}
