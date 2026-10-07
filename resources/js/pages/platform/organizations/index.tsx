import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
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
            <Head title="Organizations" />
            <h1 className="text-2xl font-semibold tracking-tight">
                Organizations
            </h1>
            <form
                onSubmit={submit}
                className="flex flex-wrap items-end gap-2"
                role="search"
            >
                <TextField
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
                    <ul className="divide-y">
                        {organizations.map((organization) => (
                            <li
                                key={organization.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {organization.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        /{organization.slug}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
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
                                        {STATE_LABEL[organization.entitlement]}
                                    </StatusChip>
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
                                </div>
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
