import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/platform/page-header';
import { RecordTable } from '@/components/platform/record-table';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import type { OrganizationRow, Pagination } from '@/types/platform';

type Props = {
    search: string;
    organizations: OrganizationRow[];
    pagination: Pagination;
};

const STATE_LABEL: Record<OrganizationRow['entitlement'], string> = {
    trial: 'Trial',
    paid: 'Paid',
    grace: 'Grace period',
    restricted: 'Restricted',
};

export default function Organizations({
    search,
    organizations,
    pagination,
}: Props) {
    const [term, setTerm] = useState(search);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.get(
            '/platform/organizations',
            term.trim() === '' ? {} : { search: term.trim() },
        );
    }

    return (
        <>
            <PageHeader
                eyebrow="Platform"
                title="Organizations"
                description="Find an organization by name or address. Customers are never listed here."
            />
            <form
                onSubmit={submit}
                className="flex flex-wrap items-end gap-2"
                role="search"
            >
                <TextField
                    controlClassName="max-sm:h-11"
                    label="Search by name or address"
                    name="search"
                    className="min-w-60 flex-1"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                />
                <Button type="submit" className="max-sm:h-11">
                    Search
                </Button>
            </form>
            <SectionCard
                title={search ? `Results for "${search}"` : 'All organizations'}
                description="Open one to see its members and start an attributable, read-only support session."
            >
                {organizations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {search
                            ? 'No organization matches that search.'
                            : 'There are no organizations yet.'}
                    </p>
                ) : (
                    <RecordTable
                        label="Organizations"
                        columns={[
                            { key: 'name', label: 'Organization' },
                            { key: 'status', label: 'Status' },
                            { key: 'published', label: 'Storefront' },
                            {
                                key: 'open',
                                label: 'Action',
                                className: 'md:text-right',
                            },
                        ]}
                        rows={organizations}
                        rowKey={(organization) => organization.id}
                        template="md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]"
                        cell={(organization, key) => {
                            switch (key) {
                                case 'name':
                                    return (
                                        <>
                                            <p className="font-semibold">
                                                {organization.name}
                                            </p>
                                            <p className="text-muted-foreground">
                                                /{organization.slug}
                                            </p>
                                        </>
                                    );
                                case 'status':
                                    return (
                                        <span className="flex flex-wrap gap-2 md:justify-start">
                                            {organization.closed ? (
                                                <StatusChip tone="warning">
                                                    Closed
                                                </StatusChip>
                                            ) : null}
                                            <StatusChip
                                                tone={
                                                    organization.entitlement ===
                                                    'restricted'
                                                        ? 'warning'
                                                        : 'neutral'
                                                }
                                            >
                                                {
                                                    STATE_LABEL[
                                                        organization.entitlement
                                                    ]
                                                }
                                            </StatusChip>
                                        </span>
                                    );
                                case 'published':
                                    return (
                                        <StatusChip
                                            tone={
                                                organization.published
                                                    ? 'success'
                                                    : 'neutral'
                                            }
                                        >
                                            {organization.published
                                                ? 'Published'
                                                : 'Not published'}
                                        </StatusChip>
                                    );
                                default:
                                    return (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="max-sm:h-11"
                                        >
                                            <Link
                                                href={organization.url}
                                                aria-label={`Open ${organization.name}`}
                                            >
                                                Open
                                            </Link>
                                        </Button>
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
