import { useForm } from '@inertiajs/react';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & { directoryOptedIn: boolean };

/**
 * Directory preference. The summary is derived from saved server state only:
 * the stored preference, the explicit publication and the shop's acceptance of
 * new bookings (the same conditions the customer directory applies). Readiness
 * is shown for context; nothing here is a new eligibility rule.
 */
export default function Directory({
    organization,
    readiness,
    entitlement,
    directoryOptedIn,
}: Props) {
    const form = useForm({ directory_opted_in: directoryOptedIn });
    const published = organization.publishedAt !== null;
    const listed =
        directoryOptedIn && published && entitlement.acceptsNewBookings;
    const reason = !directoryOptedIn
        ? 'Not listed: the directory preference is off.'
        : !published
          ? 'Not listed: the shop is not published.'
          : !entitlement.acceptsNewBookings
            ? 'Not listed: new bookings are paused for this shop.'
            : 'Customers can find this shop in the Rinquo directory.';
    const rows: { label: string; value: string; good: boolean }[] = [
        {
            label: 'Directory preference',
            value: directoryOptedIn ? 'Enabled' : 'Off',
            good: directoryOptedIn,
        },
        {
            label: 'Shop publication',
            value: published ? 'Published' : 'Draft',
            good: published,
        },
        {
            label: 'Readiness',
            value: readiness.isReady ? 'Ready' : 'Not ready',
            good: readiness.isReady,
        },
        {
            label: 'Directory listing',
            value: listed ? 'Visible' : 'Not listed',
            good: listed,
        },
    ];

    return (
        <>
            <SettingsPageHeader section="directory" />
            <div className="grid items-start gap-6 xl:grid-cols-2">
                <SectionCard
                    title="Rinquo directory"
                    description="Opt in to let customers discover the shop by business name or city."
                >
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.put(`${organization.baseUrl}/directory`);
                        }}
                    >
                        <label className="flex min-h-11 items-start gap-3 rounded-xl border bg-card p-4 text-sm">
                            <input
                                type="checkbox"
                                checked={form.data.directory_opted_in}
                                onChange={(event) =>
                                    form.setData(
                                        'directory_opted_in',
                                        event.target.checked,
                                    )
                                }
                                className="mt-0.5 size-5 accent-primary"
                            />
                            <span className="grid gap-0.5">
                                <span className="font-semibold">
                                    Show in the Rinquo directory
                                </span>
                                <span className="text-muted-foreground">
                                    The direct shop URL is unaffected.
                                </span>
                            </span>
                        </label>
                        <div className="grid gap-1 rounded-xl bg-info/10 p-4 text-sm">
                            <p className="font-semibold text-primary">
                                Eligibility
                            </p>
                            <p className="max-w-[66ch]">
                                Opting in does not guarantee listing. The shop
                                is listed only while it is published and
                                accepting new bookings.
                            </p>
                        </div>
                        <Button
                            className="w-fit max-sm:h-11"
                            disabled={form.processing}
                            aria-busy={form.processing}
                        >
                            {form.processing ? (
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {form.processing
                                ? 'Saving...'
                                : 'Save directory preference'}
                        </Button>
                    </form>
                </SectionCard>
                <SectionCard
                    title="Current state summary"
                    description="Directory visibility depends on the saved preference, publication and whether the shop accepts bookings."
                    contentClassName="grid gap-3"
                >
                    <dl className="grid gap-3">
                        {rows.map((row) => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between gap-3"
                            >
                                <dt className="text-sm text-muted-foreground">
                                    {row.label}
                                </dt>
                                <dd>
                                    <StatusChip
                                        tone={row.good ? 'success' : 'neutral'}
                                    >
                                        {row.value}
                                    </StatusChip>
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <p role="status" className="text-sm">
                        {reason}
                    </p>
                </SectionCard>
            </div>
        </>
    );
}
