import type { MouseEvent } from 'react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { buttonVariants } from '@/components/ui/button';
import { formatDateTime } from '@/lib/billing';
import type { BillingView } from '@/lib/billing-view';
import { cn } from '@/lib/utils';

type Props = {
    view: BillingView;
    organizationName: string;
    operationsUrl: string;
    timezone: string;
    /** Mounts the renewal section when the scene does not show it until asked. */
    onRenewal?: () => void;
};

const ACTION_CLASS = cn(buttonVariants(), 'w-full max-sm:h-11');

/** Moves keyboard focus and the viewport to the renewal section instead of adding a second set of request controls. */
function goToRenewal(event: MouseEvent<HTMLAnchorElement>, reveal: () => void) {
    event.preventDefault();
    reveal();
    // The section may mount on this click; wait for it before moving focus.
    window.requestAnimationFrame(() => {
        const target = document.getElementById('renewal');
        target?.scrollIntoView({ block: 'start' });
        target?.focus({ preventScroll: true });
    });
}

/**
 * Current plan and access (Spec 07 references 01-03, 10-12): the state word or
 * price as the hero, the one date that matters next, and at most one primary
 * action. Status is always text (the pill), never colour alone. Amounts and
 * dates use tabular figures.
 */
export function PlanStatusCard({
    view,
    organizationName,
    operationsUrl,
    timezone,
    onRenewal,
}: Props) {
    return (
        <SectionCard
            title="Current plan & access"
            contentClassName="grid gap-5"
        >
            <div className="flex items-start justify-between gap-3 border-b pb-5">
                <div className="grid gap-1">
                    <p className="text-sm text-muted-foreground">
                        {view.eyebrow}
                    </p>
                    <p className="flex items-baseline gap-2 text-3xl font-semibold tracking-tight tabular-nums">
                        {view.hero.text}
                        {view.hero.suffix ? (
                            <span className="text-sm font-normal tracking-normal text-muted-foreground">
                                {view.hero.suffix}
                            </span>
                        ) : null}
                    </p>
                </div>
                <StatusChip tone={view.pill.tone}>{view.pill.label}</StatusChip>
            </div>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Fact label="Organization" value={organizationName} />
                <Fact label="Plan" value="Monthly" />
                <Fact
                    label="Next important date"
                    value={
                        view.nextDate.value
                            ? `${view.nextDate.label} ${formatDateTime(view.nextDate.value, timezone)}`
                            : 'Not set'
                    }
                    wide
                />
            </dl>
            {view.action ? (
                <div className="border-t pt-5">
                    {view.action.kind === 'operations' ? (
                        <a href={operationsUrl} className={ACTION_CLASS}>
                            {view.action.label}
                        </a>
                    ) : (
                        <a
                            href="#renewal"
                            onClick={(event) =>
                                goToRenewal(event, () => onRenewal?.())
                            }
                            className={ACTION_CLASS}
                        >
                            {view.action.label}
                        </a>
                    )}
                </div>
            ) : null}
        </SectionCard>
    );
}

function Fact({
    label,
    value,
    wide,
}: {
    label: string;
    value: string;
    wide?: boolean;
}) {
    return (
        <div className={cn('grid gap-0.5', wide && 'sm:col-span-2')}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
    );
}
