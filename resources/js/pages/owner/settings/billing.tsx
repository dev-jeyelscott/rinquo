import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { BillingBanner } from '@/components/billing/billing-banner';
import {
    ImportantInformation,
    SafeNextStep,
    WhatRemainsTrue,
} from '@/components/billing/billing-panels';
import { ClosureCard } from '@/components/billing/closure-card';
import { PlanStatusCard } from '@/components/billing/plan-status-card';
import { RenewalCard } from '@/components/billing/renewal-card';
import { EntitlementBanner } from '@/components/owner/entitlement-banner';
import { useNow } from '@/hooks/use-now';
import { useOnline } from '@/hooks/use-online';
import { describeBilling } from '@/lib/billing-view';
import type { BillingPageData, BillingUrls } from '@/types/billing';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & { billing: BillingPageData; urls: BillingUrls };

/**
 * Owner billing (Spec 07 references 01-19): a state banner, the current plan
 * and access, the renewal flow, the standing policy and, last and visually
 * separate, the explicit closure. The right column holds what stays true and
 * the one safe next step. Every state is derived from server props; the page
 * never claims a payment the server has not confirmed. The Owner shell is
 * assigned by the layout resolver in app.tsx for owner/settings/* and renders
 * no entitlement banner on Billing, so this page owns its banner.
 */
export default function Billing({
    organization,
    entitlement,
    billing,
    urls,
}: Props) {
    const { props } = usePage<{
        displayTimezone?: string;
        errors?: Record<string, string>;
    }>();
    const timezone = props.displayTimezone ?? 'Asia/Manila';
    const now = useNow(60_000);
    const online = useOnline();
    const view = describeBilling({
        entitlement,
        billing,
        now,
        online,
        timezone,
    });
    const closed = view.scene === 'closed' || view.scene === 'recovery_ended';
    // References 01-03 show only the plan-card action until a renewal is started:
    // the request section mounts on that action or once a request or result exists.
    const [renewalAsked, setRenewalAsked] = useState(false);
    const quietScene = ['trial', 'paid', 'renewal'].includes(view.scene);
    const renewalStarted =
        renewalAsked ||
        !quietScene ||
        billing.request !== null ||
        billing.lastPayment !== null ||
        billing.lastRequestExpiredAt !== null ||
        !billing.billingAvailable ||
        Boolean(props.errors?.billing);

    return (
        <>
            <Head title="Billing" />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="grid min-w-0 gap-6">
                    {view.banner ? (
                        <BillingBanner banner={view.banner} />
                    ) : (
                        <EntitlementBanner
                            entitlement={entitlement}
                            billingUrl={urls.billing}
                            onBilling
                            timezone={timezone}
                        />
                    )}
                    <PlanStatusCard
                        view={view}
                        organizationName={organization.name}
                        operationsUrl={organization.operationsUrl}
                        timezone={timezone}
                        onRenewal={() => setRenewalAsked(true)}
                    />
                    {closed || !renewalStarted ? null : (
                        <RenewalCard
                            billing={billing}
                            urls={urls}
                            timezone={timezone}
                            organizationName={organization.name}
                            operationsUrl={organization.operationsUrl}
                            errorMessage={props.errors?.billing}
                            announceStatus={view.banner === null}
                        />
                    )}
                    <ImportantInformation
                        view={view}
                        graceDays={billing.plan.graceDays}
                        timezone={timezone}
                    />
                    <ClosureCard
                        organizationName={organization.name}
                        entitlement={entitlement}
                        urls={urls}
                        recoveryDays={billing.closureRecoveryDays}
                        timezone={timezone}
                    />
                </div>
                <aside aria-label="Billing guarantees" className="grid gap-6">
                    <WhatRemainsTrue view={view} />
                    <SafeNextStep view={view} />
                </aside>
            </div>
        </>
    );
}
