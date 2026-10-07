import { Head, Link } from '@inertiajs/react';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
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
            <Head title="Platform overview" />
            <h1 className="text-2xl font-semibold tracking-tight">
                Platform overview
            </h1>
            {failedJobs > 0 ? (
                <Alert className={ALERT_TONES.warning}>
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            <strong className="tabular-nums">
                                {failedJobs}
                            </strong>{' '}
                            failed{' '}
                            {failedJobs === 1 ? 'job needs' : 'jobs need'}{' '}
                            attention.
                        </span>
                        <Button asChild size="sm" className="max-sm:h-11">
                            <Link href="/platform/failed-jobs">
                                Review failed jobs
                            </Link>
                        </Button>
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
            {liveSupportSession ? (
                <Alert>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            You have a live support session for{' '}
                            {liveSupportSession.organizationName}.
                        </span>
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
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
                <SectionCard
                    title="Current plan terms"
                    description="One global plan; changes apply from an effective time."
                >
                    <dl className="grid gap-1 text-sm tabular-nums">
                        <div className="flex justify-between gap-4">
                            <dt>Monthly price</dt>
                            <dd>{formatCentavos(plan.amountCentavos)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>Trial</dt>
                            <dd>{plan.trialDays} days</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>Grace</dt>
                            <dd>{plan.graceDays} days</dd>
                        </div>
                    </dl>
                </SectionCard>
                <SectionCard title="Administrators">
                    <p className="text-sm">
                        <span className="tabular-nums">{activeAdmins}</span>{' '}
                        active{' '}
                        {activeAdmins === 1
                            ? 'administrator'
                            : 'administrators'}
                        .
                    </p>
                </SectionCard>
            </div>
        </>
    );
}
