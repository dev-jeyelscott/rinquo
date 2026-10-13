import { Link, usePage } from '@inertiajs/react';
import { TriangleAlertIcon } from 'lucide-react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { PageHeader } from '@/components/platform/page-header';
import { RecordTable } from '@/components/platform/record-table';
import type { RecordColumn } from '@/components/platform/record-table';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/datetime';
import { ALERT_TONES } from '@/lib/tones';
import type { FailedJobRow, Pagination, RetryRow } from '@/types/platform';

type Props = {
    jobs: FailedJobRow[];
    total: number;
    pagination: Pagination;
    recentRetries: RetryRow[];
};

const RETRY_STATUS: Record<
    RetryRow['status'],
    { label: string; meaning: string; tone: 'info' | 'warning' | 'neutral' }
> = {
    claimed: {
        label: 'Claimed',
        meaning: 'Retry in progress',
        tone: 'warning',
    },
    queued: {
        label: 'Queued',
        meaning:
            'Returned to queue. This confirms dispatch only, not completion.',
        tone: 'info',
    },
    dispatch_failed: {
        label: 'Dispatch failed',
        meaning: 'Queue unavailable, not retried. The job is retained.',
        tone: 'neutral',
    },
};

const JOB_COLUMNS: RecordColumn[] = [
    { key: 'job', label: 'Job' },
    { key: 'queue', label: 'Queue' },
    { key: 'exception', label: 'Exception class' },
    { key: 'failed', label: 'Failed at' },
    { key: 'retry', label: 'Retry', className: 'md:text-right' },
];

const RETRY_COLUMNS: RecordColumn[] = [
    { key: 'job', label: 'Job' },
    { key: 'time', label: 'Time' },
    { key: 'outcome', label: 'Outcome' },
    { key: 'meaning', label: 'Interpretation' },
];

export default function FailedJobs({
    jobs,
    total,
    pagination,
    recentRetries,
}: Props) {
    const tz = usePage().props.displayTimezone;

    return (
        <>
            <PageHeader
                eyebrow="Failures"
                title="Failed jobs"
                description="Review safe failure metadata and retry only verified job classes, one at a time."
            />
            <Alert className={ALERT_TONES.warning}>
                <TriangleAlertIcon aria-hidden="true" />
                <AlertDescription>
                    <strong>
                        Failed jobs do not establish overall queue health.
                    </strong>{' '}
                    Job payloads, exception messages and secrets are never
                    displayed.
                </AlertDescription>
            </Alert>
            <SectionCard
                title={`${total} failed ${total === 1 ? 'job' : 'jobs'}`}
                description="Only jobs proven safe to run again can be retried, one at a time."
            >
                {jobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No failed jobs are retained.
                    </p>
                ) : (
                    <RecordTable
                        label="Failed jobs"
                        columns={JOB_COLUMNS}
                        rows={jobs}
                        rowKey={(job) => job.uuid}
                        template="md:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)]"
                        cell={(job, key) => {
                            switch (key) {
                                case 'job':
                                    return (
                                        <>
                                            <p className="font-mono font-semibold">
                                                {job.jobClass}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {job.retryNote}
                                            </p>
                                        </>
                                    );
                                case 'queue':
                                    return job.queue;
                                case 'exception':
                                    return job.exceptionClass;
                                case 'failed':
                                    return (
                                        <span className="tabular-nums">
                                            {formatInstant(job.failedAt, tz)}
                                        </span>
                                    );
                                default:
                                    return job.retryable ? (
                                        <StepUpDialog
                                            label="Retry"
                                            ariaLabel={`Retry ${job.jobClass}`}
                                            title="Retry this job"
                                            description={`Returns this one job to the ${job.queue} queue. ${job.retryNote} Returned to queue confirms dispatch only, not completion. The original failure stays in the retry record.`}
                                            confirmLabel="Retry job"
                                            pendingLabel="Retrying..."
                                            url={`/platform/failed-jobs/${job.uuid}/retry`}
                                            triggerVariant="default"
                                        />
                                    ) : (
                                        <StatusChip tone="warning">
                                            Not retryable here
                                        </StatusChip>
                                    );
                            }
                        }}
                    />
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
                description="Retry history is attributable and safe to view. It does not expose payloads or secrets."
            >
                {recentRetries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No retries yet.
                    </p>
                ) : (
                    <RecordTable
                        label="Recent retries"
                        columns={RETRY_COLUMNS}
                        rows={recentRetries}
                        rowKey={(retry) => `${retry.jobUuid}-${retry.at}`}
                        template="md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,2fr)]"
                        cell={(retry, key) => {
                            const status = RETRY_STATUS[retry.status];

                            switch (key) {
                                case 'job':
                                    return (
                                        <span className="font-mono font-semibold">
                                            {retry.jobClass}
                                        </span>
                                    );
                                case 'time':
                                    return (
                                        <span className="tabular-nums">
                                            {formatInstant(retry.at, tz)}
                                        </span>
                                    );
                                case 'outcome':
                                    return (
                                        <StatusChip tone={status.tone}>
                                            {status.label}
                                        </StatusChip>
                                    );
                                default:
                                    return status.meaning;
                            }
                        }}
                    />
                )}
            </SectionCard>
        </>
    );
}
