import { Link } from '@inertiajs/react';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { PageHeader } from '@/components/platform/page-header';
import { SectionCard } from '@/components/owner/section-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCentavos } from '@/lib/money';
import { ALERT_TONES } from '@/lib/tones';
import type { PlanTermsValues } from '@/types/platform';

type Props = {
    failedJobs: number;
    activeAdmins: number;
    plan: PlanTermsValues;
    liveSupportSession: {
        id: string;
        organizationName: string;
        expiresAt: string;
        url: string;
    } | null;
};

export default function Overview({
    failedJobs,
    activeAdmins,
    plan,
    liveSupportSession,
}: Props) {
    return (
        <>
            <PageHeader
                eyebrow="Platform"
                title="Platform overview"
                description="Operational entry point. Counts come from existing safe read models."
                action={
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="max-sm:h-11"
                    >
                        <Link href="/platform/failed-jobs">
                            Review failed jobs
                        </Link>
                    </Button>
                }
            />
            {failedJobs > 0 ? (
                <Alert className={ALERT_TONES.warning}>
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            <strong className="tabular-nums">
                                {failedJobs}
                            </strong>{' '}
                            retained failed{' '}
                            {failedJobs === 1 ? 'job needs' : 'jobs need'}{' '}
                            attention. This is not a live queue-health
                            measurement.
                        </span>
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert className={ALERT_TONES.success} role="status">
                    <CircleCheckIcon aria-hidden="true" />
                    <AlertDescription>
                        No failed jobs are waiting. This reflects the retained
                        failed-job table only, not live queue health.
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-3">
                <SectionCard title="Retained failed jobs">
                    <p className="text-3xl font-semibold tabular-nums">
                        {failedJobs}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Safe jobs may be retried individually.
                    </p>
                </SectionCard>
                <SectionCard title="Active administrators">
                    <p className="text-3xl font-semibold tabular-nums">
                        {activeAdmins}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Separated from tenant identities.
                    </p>
                </SectionCard>
                <SectionCard title="Global plan">
                    <p className="text-3xl font-semibold tabular-nums">
                        {formatCentavos(plan.amountCentavos)}
                    </p>
                    <p className="text-sm text-muted-foreground">Monthly</p>
                </SectionCard>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <SectionCard
                    title="Current plan terms"
                    description="One global plan; changes apply from an effective time."
                >
                    <dl className="grid gap-1 text-sm tabular-nums">
                        <div className="flex justify-between gap-4 border-b py-2">
                            <dt>Monthly price</dt>
                            <dd className="font-medium">
                                {formatCentavos(plan.amountCentavos)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b py-2">
                            <dt>Trial</dt>
                            <dd className="font-medium">
                                {plan.trialDays} days
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4 py-2">
                            <dt>Grace</dt>
                            <dd className="font-medium">
                                {plan.graceDays} days
                            </dd>
                        </div>
                    </dl>
                </SectionCard>
                <SectionCard title="Active support session">
                    {liveSupportSession ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                                You have a live support session for{' '}
                                <strong>
                                    {liveSupportSession.organizationName}
                                </strong>
                                .
                            </p>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="max-sm:h-11"
                            >
                                <Link href={liveSupportSession.url}>
                                    Return to it
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No support session is active.
                        </p>
                    )}
                    <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        Sessions are limited to one member, one organization,
                        and 30 minutes.
                    </p>
                </SectionCard>
            </div>
        </>
    );
}
