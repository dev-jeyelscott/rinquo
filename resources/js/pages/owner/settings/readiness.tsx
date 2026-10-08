import { useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { ReadinessChecklist } from '@/components/owner/readiness-checklist';
import { SectionCard } from '@/components/owner/section-card';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { reasonLabel } from '@/lib/availability';
import { formatInstant } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';

type VariantStatus = {
    variant_id: number;
    service_name: string;
    vehicle_type_name: string;
    available: boolean;
    reasons: string[];
};

type Props = OwnerPageProps & {
    variants: VariantStatus[];
    branchTimezone: string;
};

type PanelTone = 'success' | 'warning';

/** Tinted status block (reference "Impact preview"): bold headline plus one quiet line. */
function StatusPanel({
    tone,
    title,
    children,
    className,
}: {
    tone: PanelTone;
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            role="status"
            className={cn(
                'grid gap-1 rounded-xl p-4',
                tone === 'success'
                    ? 'bg-success/10 text-success-text'
                    : 'bg-warning/10 text-warning-text',
                className,
            )}
        >
            <p className="text-lg leading-snug font-semibold">{title}</p>
            <p className="text-sm">{children}</p>
        </div>
    );
}

export default function Readiness({
    organization,
    readiness,
    variants,
    branchTimezone,
}: Props) {
    const publish = useForm({});
    const published = organization.publishedAt !== null;
    const error = (publish.errors as Record<string, string | undefined>)
        .publish;
    const failingCount = readiness.items.filter((item) => !item.passed).length;

    /**
     * The publication status leads on small screens (above the checklist) and
     * sits inside the Publish card from xl up; `placement` picks which copy is
     * visible, so only one is ever rendered to assistive technology.
     */
    const publicationStatus = (placement: 'lead' | 'card') => {
        const className = placement === 'lead' ? 'xl:hidden' : 'max-xl:hidden';

        if (published && organization.publishedAt) {
            return (
                <StatusPanel
                    tone="success"
                    title="Your shop is live"
                    className={className}
                >
                    Published on{' '}
                    {formatInstant(organization.publishedAt, branchTimezone)} (
                    {branchTimezone}).
                </StatusPanel>
            );
        }

        return readiness.isReady ? (
            <StatusPanel
                tone="success"
                title="Ready to publish"
                className={className}
            >
                All checks pass. You can publish now.
            </StatusPanel>
        ) : (
            <StatusPanel
                tone="warning"
                title={`${failingCount} ${failingCount === 1 ? 'check needs' : 'checks need'} attention`}
                className={className}
            >
                Complete the checklist to enable publishing.
            </StatusPanel>
        );
    };

    return (
        <>
            <SettingsPageHeader section="readiness" />
            <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
                {publicationStatus('lead')}
                <SectionCard
                    title="Readiness checklist"
                    description="Every check must pass before you can publish. The server re-checks when you press Publish."
                    contentClassName="grid gap-6"
                >
                    <ReadinessChecklist
                        items={readiness.items}
                        baseUrl={organization.baseUrl}
                    />
                    <section
                        aria-label="Service and vehicle combinations"
                        className="grid gap-3"
                    >
                        <h3 className="text-base font-semibold">
                            Combinations
                        </h3>
                        {variants.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No service and vehicle combinations yet.
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {variants.map((variant) => (
                                    <li
                                        key={variant.variant_id}
                                        className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"
                                    >
                                        <div className="grid min-w-0 gap-1">
                                            <span className="font-semibold">
                                                {variant.service_name} for{' '}
                                                {variant.vehicle_type_name}
                                            </span>
                                            {variant.available ? null : (
                                                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                                    {variant.reasons.map(
                                                        (reason) => (
                                                            <li key={reason}>
                                                                {reasonLabel(
                                                                    reason,
                                                                )}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                        <StatusChip
                                            tone={
                                                variant.available
                                                    ? 'success'
                                                    : 'warning'
                                            }
                                        >
                                            {variant.available
                                                ? 'Bookable'
                                                : 'Unavailable'}
                                        </StatusChip>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </SectionCard>
                <SectionCard
                    title="Publish"
                    description="Your shop page stays private until you publish it."
                    contentClassName="grid gap-4"
                >
                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                    {published && organization.publishedAt ? (
                        <>
                            {publicationStatus('card')}
                            <p className="text-sm">
                                Public page:{' '}
                                <a
                                    href={organization.shopUrl}
                                    className="break-all text-primary underline underline-offset-4"
                                >
                                    {organization.shopUrl}
                                </a>
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="w-full max-sm:h-11"
                            >
                                <a href={organization.shopUrl}>
                                    View public page
                                </a>
                            </Button>
                            <ConfirmAction
                                label="Unpublish"
                                ariaLabel="Unpublish your shop"
                                title="Unpublish your shop?"
                                description="Customers will see an unavailable page until you publish again."
                                confirmLabel="Unpublish"
                                url={`${organization.baseUrl}/unpublish`}
                            />
                        </>
                    ) : (
                        <>
                            {publicationStatus('card')}
                            <Button
                                type="button"
                                size="lg"
                                className="w-full max-sm:h-11"
                                disabled={
                                    !readiness.isReady || publish.processing
                                }
                                aria-busy={publish.processing}
                                onClick={() =>
                                    publish.post(
                                        `${organization.baseUrl}/publish`,
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                {publish.processing ? (
                                    <Spinner
                                        role="presentation"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {publish.processing
                                    ? 'Publishing...'
                                    : 'Publish shop'}
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                This slice publishes your catalog only. Online
                                booking is not accepted yet.
                            </p>
                        </>
                    )}
                </SectionCard>
            </div>
        </>
    );
}
