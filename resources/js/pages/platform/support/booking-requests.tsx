import { Link, usePage } from '@inertiajs/react';
import { PageHeader } from '@/components/platform/page-header';
import { RecordTable } from '@/components/platform/record-table';
import { StatusChip } from '@/components/owner/status-chip';
import { SectionCard } from '@/components/owner/section-card';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/datetime';
import type { Pagination, SupportRequestRow } from '@/types/platform';

type Props = {
    requests: SupportRequestRow[];
    pagination: Pagination;
    overviewUrl: string;
};

export default function SupportBookingRequests({
    requests,
    pagination,
    overviewUrl,
}: Props) {
    const tz = usePage().props.displayTimezone;

    return (
        <>
            <PageHeader
                eyebrow="Support"
                title="Pending booking requests"
                documentTitle="Support: booking requests"
                description="Read-only and redacted. Only allowlisted request fields are shown."
            />
            <p>
                <Link
                    href={overviewUrl}
                    className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4 sm:min-h-0"
                >
                    Back to overview
                </Link>
            </p>
            <SectionCard
                title="Awaiting a decision"
                description="Customer contact details and notes are not shown in support views. You cannot approve or decline from here."
            >
                {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No requests are waiting for a decision.
                    </p>
                ) : (
                    <RecordTable
                        label="Pending booking requests"
                        columns={[
                            { key: 'request', label: 'Service and vehicle' },
                            { key: 'start', label: 'Planned time' },
                            { key: 'status', label: 'Status' },
                        ]}
                        rows={requests}
                        rowKey={(request) => request.id}
                        template="md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,0.8fr)]"
                        cell={(request, key) => {
                            switch (key) {
                                case 'request':
                                    return (
                                        <span className="font-semibold">
                                            {request.serviceName},{' '}
                                            {request.vehicleName}
                                        </span>
                                    );
                                case 'start':
                                    return (
                                        <span className="tabular-nums">
                                            Starts{' '}
                                            {formatInstant(request.startAt, tz)}
                                            {request.pendingExpiresAt
                                                ? `, decide by ${formatInstant(request.pendingExpiresAt, tz)}`
                                                : ''}
                                        </span>
                                    );
                                default:
                                    return (
                                        <StatusChip tone="warning">
                                            Pending
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
                                <Link href={pagination.previousUrl}>
                                    Previous
                                </Link>
                            </Button>
                        ) : null}
                        {pagination.nextUrl ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="max-sm:h-11"
                            >
                                <Link href={pagination.nextUrl}>Next</Link>
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </SectionCard>
        </>
    );
}
