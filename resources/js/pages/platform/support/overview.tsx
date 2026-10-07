import { Head, Link, usePage } from '@inertiajs/react';
import { CheckCircle2Icon, CircleXIcon } from 'lucide-react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/datetime';
import type { ReadinessLine } from '@/types/platform';

type Props = {
    organization: {
        name: string;
        slug: string;
        tagline: string | null;
        published: boolean;
    };
    ownerDetail: {
        entitlement: string;
        closed: boolean;
        trialEndsAt: string | null;
        paidUntil: string | null;
        graceEndsAt: string | null;
        readiness: ReadinessLine[];
    } | null;
    members: { email: string; role: 'owner' | 'staff' }[];
    bookingRequestsUrl: string;
};

export default function SupportOverview({
    organization,
    ownerDetail,
    members,
    bookingRequestsUrl,
}: Props) {
    const tz = usePage().props.displayTimezone;

    return (
        <>
            <Head title={`Support: ${organization.name}`} />
            <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                    tone={organization.published ? 'success' : 'neutral'}
                >
                    {organization.published ? 'Published' : 'Not published'}
                </StatusChip>
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                >
                    <Link href={bookingRequestsUrl}>
                        Pending booking requests
                    </Link>
                </Button>
            </div>
            {ownerDetail ? (
                <SectionCard
                    title="Subscription and readiness"
                    description="Shown because this member is an owner."
                >
                    <dl className="grid gap-1 text-sm sm:max-w-md">
                        <div className="flex justify-between gap-4">
                            <dt>Billing state</dt>
                            <dd className="font-medium">
                                {ownerDetail.entitlement}
                                {ownerDetail.closed ? ' (closed)' : ''}
                            </dd>
                        </div>
                        {ownerDetail.paidUntil ? (
                            <div className="flex justify-between gap-4">
                                <dt>Paid until</dt>
                                <dd className="tabular-nums">
                                    {formatInstant(ownerDetail.paidUntil, tz)}
                                </dd>
                            </div>
                        ) : null}
                        {ownerDetail.trialEndsAt ? (
                            <div className="flex justify-between gap-4">
                                <dt>Trial ends</dt>
                                <dd className="tabular-nums">
                                    {formatInstant(ownerDetail.trialEndsAt, tz)}
                                </dd>
                            </div>
                        ) : null}
                        {ownerDetail.graceEndsAt ? (
                            <div className="flex justify-between gap-4">
                                <dt>Grace ends</dt>
                                <dd className="tabular-nums">
                                    {formatInstant(ownerDetail.graceEndsAt, tz)}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                    <ul
                        className="mt-4 grid gap-2 text-sm"
                        aria-label="Readiness checklist"
                    >
                        {ownerDetail.readiness.map((item) => (
                            <li
                                key={item.label}
                                className="flex items-start gap-2"
                            >
                                {item.passed ? (
                                    <CheckCircle2Icon
                                        className="mt-0.5 size-4 text-success"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <CircleXIcon
                                        className="mt-0.5 size-4 text-destructive"
                                        aria-hidden="true"
                                    />
                                )}
                                <span>
                                    <span className="font-medium">
                                        {item.label}
                                    </span>
                                    <span className="sr-only">
                                        {item.passed
                                            ? ': ready'
                                            : ': needs attention'}
                                    </span>
                                    {item.detail ? (
                                        <span className="text-muted-foreground">
                                            . {item.detail}
                                        </span>
                                    ) : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            ) : (
                <SectionCard
                    title="Limited view"
                    description="This member is staff, so owner-only billing and readiness detail is not shown."
                />
            )}
            <SectionCard title="Members">
                <ul className="divide-y text-sm">
                    {members.map((member) => (
                        <li
                            key={member.email}
                            className="flex items-center justify-between gap-3 py-2"
                        >
                            <span>{member.email}</span>
                            <StatusChip caps>{member.role}</StatusChip>
                        </li>
                    ))}
                </ul>
            </SectionCard>
        </>
    );
}
