import { Head, Link, usePage } from '@inertiajs/react';
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
            <Head title="Support: booking requests" />
            <p>
                <Link
                    href={overviewUrl}
                    className="text-sm underline underline-offset-4"
                >
                    Back to overview
                </Link>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
                Pending booking requests
            </h1>
            <SectionCard
                title="Awaiting a decision"
                description="Customer contact details and notes are not shown in support views. You cannot approve or decline from here."
            >
                {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No requests are waiting for a decision.
                    </p>
                ) : (
                    <ul className="divide-y text-sm">
                        {requests.map((request) => (
                            <li key={request.id} className="grid gap-0.5 py-3">
                                <p className="font-medium">
                                    {request.serviceName}, {request.vehicleName}
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                    Starts {formatInstant(request.startAt, tz)}
                                    {request.pendingExpiresAt
                                        ? `, decide by ${formatInstant(request.pendingExpiresAt, tz)}`
                                        : ''}
                                </p>
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
