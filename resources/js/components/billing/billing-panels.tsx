import { CheckIcon } from 'lucide-react';
import { SectionCard } from '@/components/owner/section-card';
import type { BillingView } from '@/lib/billing-view';

/** The standing guarantees for the current scene (Spec 07 "What remains true"). */
export function WhatRemainsTrue({ view }: { view: BillingView }) {
    return (
        <SectionCard title="What remains true" headingLevel="h2">
            <ul className="grid gap-3 text-sm">
                {view.remains.map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                        <CheckIcon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-success"
                        />
                        <span className="max-w-[65ch]">{line}</span>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

/** One calm sentence on what is safe to do next; never a second call to action. */
export function SafeNextStep({ view }: { view: BillingView }) {
    return (
        <SectionCard title="Safe next step">
            <p className="max-w-[65ch] text-sm text-muted-foreground">
                {view.safeNext}
            </p>
        </SectionCard>
    );
}

/** Server-owned billing terms, with the scene's policy sentence first. */
export function ImportantInformation({
    view,
    graceDays,
    timezone,
}: {
    view: BillingView;
    graceDays: number;
    timezone: string;
}) {
    const facts: [string, string][] = [
        ['Billing cycle', 'One calendar month'],
        ['Pay via', 'PayMongo QR Ph'],
        ['Grace policy', `${graceDays} days (paid only)`],
        ['Timezone', timezone],
    ];

    return (
        <SectionCard title="Important information">
            <p className="max-w-[65ch] text-sm text-muted-foreground">
                {view.policy}
            </p>
            <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                {facts.map(([label, value]) => (
                    <div key={label} className="grid gap-0.5">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>
        </SectionCard>
    );
}
