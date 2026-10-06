import { Head, usePage } from '@inertiajs/react';
import { ClosureCard } from '@/components/billing/closure-card';
import { PlanStatusCard } from '@/components/billing/plan-status-card';
import { RenewalCard } from '@/components/billing/renewal-card';
import type { BillingPageData, BillingUrls } from '@/types/billing';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & { billing: BillingPageData; urls: BillingUrls };

/**
 * Owner billing: the plan and access state first, the renewal action second,
 * and the explicit closure last in its own danger section so it can never be
 * mistaken for cancelling a subscription. The Owner shell is assigned by the
 * layout resolver in app.tsx for owner/settings/*; the page must not wrap itself.
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

    return (
        <>
            <Head title="Billing" />
            <div className="grid max-w-3xl gap-6">
                <PlanStatusCard
                    entitlement={entitlement}
                    plan={billing.plan}
                    timezone={timezone}
                />
                <RenewalCard
                    billing={billing}
                    urls={urls}
                    timezone={timezone}
                    organizationName={organization.name}
                    operationsUrl={organization.operationsUrl}
                    errorMessage={props.errors?.billing}
                />
                <ClosureCard
                    organizationName={organization.name}
                    entitlement={entitlement}
                    urls={urls}
                    recoveryDays={billing.closureRecoveryDays}
                    timezone={timezone}
                />
            </div>
        </>
    );
}
