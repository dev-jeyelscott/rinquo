import { StatusChip } from '@/components/owner/status-chip';
import { SectionCard } from '@/components/owner/section-card';
import {
    accessEndsAt,
    formatDateTime,
    STATE_LABEL,
    STATE_TONE,
} from '@/lib/billing';
import { formatCentavos } from '@/lib/money';
import type { BillingPageData } from '@/types/billing';
import type { Entitlement } from '@/types/owner';

type Props = {
    entitlement: Entitlement;
    plan: BillingPageData['plan'];
    timezone: string;
};

function explanation(entitlement: Entitlement, timezone: string): string {
    const at = (iso: string | null) =>
        iso ? formatDateTime(iso, timezone) : '';

    switch (entitlement.state) {
        case 'trial':
            return `Your free trial runs until ${at(entitlement.trialEndsAt)}. A payment made now buys one month that starts when the trial ends, so nothing is lost by paying early.`;
        case 'paid':
            return `Access is paid through ${at(entitlement.paidUntil)}. Paying again before then adds a month to that date.`;
        case 'grace':
            return `Your paid period ended. The shop keeps working during the grace period, which ends ${at(entitlement.graceEndsAt)}.`;
        default:
            return `Restriction began ${at(entitlement.graceEndsAt)}. New bookings and configuration changes are paused; existing bookings are unaffected. A month paid now starts when the payment is confirmed.`;
    }
}

/** The current entitlement: state, plan price and the exact instants it is derived from. */
export function PlanStatusCard({ entitlement, plan, timezone }: Props) {
    const accessEnds = accessEndsAt(
        entitlement.trialEndsAt,
        entitlement.paidUntil,
    );
    const rows: { label: string; value: string | null }[] = [
        { label: 'Trial ends', value: entitlement.trialEndsAt },
        { label: 'Paid through', value: entitlement.paidUntil },
        { label: 'Access ends', value: accessEnds },
        { label: 'New bookings pause', value: entitlement.graceEndsAt },
    ];

    return (
        <SectionCard
            title="Plan and access"
            description={`${formatCentavos(plan.amountCentavos)} per month, paid by QR Ph. Each payment buys one calendar month.`}
            badge={
                <StatusChip tone={STATE_TONE[entitlement.state]}>
                    {STATE_LABEL[entitlement.state]}
                </StatusChip>
            }
        >
            <p className="max-w-[65ch] text-sm text-muted-foreground">
                {explanation(entitlement, timezone)}
            </p>
            <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                {rows.map((row) => (
                    <div key={row.label} className="grid gap-0.5">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="font-semibold tabular-nums">
                            {row.value
                                ? formatDateTime(row.value, timezone)
                                : 'Not set'}
                        </dd>
                    </div>
                ))}
            </dl>
        </SectionCard>
    );
}
