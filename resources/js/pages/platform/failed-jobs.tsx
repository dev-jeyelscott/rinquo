import { Head, Link, usePage } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/datetime';
import type { FailedJobRow, Pagination, RetryRow } from '@/types/platform';

type Props = {
    jobs: FailedJobRow[];
    total: number;
    pagination: Pagination;
    recentRetries: RetryRow[];
};

const RETRY_STATUS: Record<RetryRow['status'], string> = {
    claimed: 'Retry in progress',
    queued: 'Returned to queue',
    dispatch_failed: 'Queue unavailable, not retried',
};

export default function FailedJobs({
    jobs,
    total,
    pagination,
    recentRetries,
}: Props) {
    const tz = usePage().props.displayTimezone;

    return (
        <>
            <Head title="Failed jobs" />
            <h1 className="text-2xl font-semibold tracking-tight">
                Failed jobs
            </h1>
            <SectionCard
                title={`${total} failed ${total === 1 ? 'job' : 'jobs'}`}
                description="Payloads and error messages are never shown. Only jobs proven safe to run again can be retried, one at a time."
            >
                {jobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No failed jobs are retained.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {jobs.map((job) => (
                            <li
                                key={job.uuid}
                                className="flex flex-wrap items-start justify-between gap-3 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium break-all">
                                        {job.jobClass}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {job.exceptionClass} on queue{' '}
                                        {job.queue}, failed{' '}
                                        {formatInstant(job.failedAt, tz)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {job.retryNote}
                                    </p>
                                </div>
                                {job.retryable ? (
                                    <StepUpDialog
                                        label="Retry"
                                        ariaLabel={`Retry ${job.jobClass}`}
                                        title="Retry this job"
                                        description={`Returns this one job to the ${job.queue} queue. ${job.retryNote} The original failure stays in the retry record.`}
                                        confirmLabel="Retry job"
                                        pendingLabel="Retrying..."
                                        url={`/platform/failed-jobs/${job.uuid}/retry`}
                                    />
                                ) : (
                                    <StatusChip tone="neutral">
                                        Not retryable here
                                    </StatusChip>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {pagination.previousUrl || pagination.nextUrl ? (
                    <div className="mt-4 flex gap-2">
                        {pagination.previousUrl ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="max-sm:h-11"
                            >
                                <Link href={pagination.previousUrl}>Newer</Link>
                            </Button>
                        ) : null}
                        {pagination.nextUrl ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="max-sm:h-11"
                            >
                                <Link href={pagination.nextUrl}>Older</Link>
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </SectionCard>
            <SectionCard
                title="Recent retries"
                description="Evidence of what was retried, by whom, and the outcome."
            >
                {recentRetries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No retries yet.
                    </p>
                ) : (
                    <ul className="divide-y text-sm">
                        {recentRetries.map((retry) => (
                            <li
                                key={`${retry.jobUuid}-${retry.at}`}
                                className="py-2 break-words"
                            >
                                <span className="font-medium [overflow-wrap:anywhere]">
                                    {retry.jobClass}
                                </span>
                                : {RETRY_STATUS[retry.status]},{' '}
                                {formatInstant(retry.at, tz)}
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </>
    );
}
