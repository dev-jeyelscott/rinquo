import { Head } from '@inertiajs/react';
import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField } from '@/components/owner/config-form';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Card, CardContent } from '@/components/ui/card';
import type { OwnerPageProps } from '@/types/owner';

type Resource = {
    id: number;
    name: string;
    capacity: number;
    isActive: boolean;
    archived: boolean;
};

type ResourceType = {
    id: number;
    name: string;
    isActive: boolean;
    archived: boolean;
    resources: Resource[];
};

type Props = OwnerPageProps & { resourceTypes: ResourceType[] };

const NAME: ConfigField = {
    kind: 'text',
    name: 'name',
    label: 'Name',
    required: true,
    maxLength: 120,
};
const CAPACITY: ConfigField = {
    kind: 'number',
    name: 'capacity',
    label: 'Capacity (units)',
    required: true,
    min: 1,
    max: 10000,
    hint: 'Whole units one booking can draw from.',
};
const ACTIVE: ConfigField = {
    kind: 'checkbox',
    name: 'is_active',
    label: 'Active',
};

export default function Resources({ organization, resourceTypes }: Props) {
    const base = organization.baseUrl;

    return (
        <>
            <Head title="Resources" />
            <div className="grid gap-6">
                <p className="max-w-prose text-sm text-muted-foreground">
                    A resource type (for example a wash bay) holds physical
                    resources with a capacity in whole units. A variant is only
                    bookable when one active resource can hold the units it
                    consumes.
                </p>
                {resourceTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No resource types yet. Add your first one below.
                    </p>
                ) : null}
                {resourceTypes.map((type) => (
                    <SectionCard
                        key={type.id}
                        role="group"
                        aria-label={type.name}
                        title={type.name}
                        description={
                            type.archived
                                ? 'Archived resource types keep their history.'
                                : undefined
                        }
                        contentClassName="grid gap-5"
                        badge={
                            type.archived ? (
                                <StatusChip>Archived</StatusChip>
                            ) : (
                                <StatusChip
                                    tone={type.isActive ? 'success' : 'neutral'}
                                >
                                    {type.isActive ? 'Active' : 'Inactive'}
                                </StatusChip>
                            )
                        }
                    >
                        {type.archived ? null : (
                            <>
                                <ConfigForm
                                    method="patch"
                                    url={`${base}/resource-types/${type.id}`}
                                    title={`Edit resource type ${type.name}`}
                                    submitLabel="Save resource type"
                                    variant="secondary"
                                    inline
                                    fields={[NAME, ACTIVE]}
                                    initial={{
                                        name: type.name,
                                        is_active: type.isActive,
                                    }}
                                />
                                <ul
                                    aria-label={`Resources of ${type.name}`}
                                    className="grid gap-3"
                                >
                                    {type.resources.length === 0 ? (
                                        <li className="text-sm text-muted-foreground">
                                            No resources yet. Variants using
                                            this type stay unavailable.
                                        </li>
                                    ) : null}
                                    {type.resources.map((resource) => (
                                        <li
                                            key={resource.id}
                                            className="grid gap-2 rounded-xl border bg-card p-3"
                                        >
                                            {resource.archived ? (
                                                <p className="flex items-center gap-2 text-sm">
                                                    {resource.name} ·{' '}
                                                    {resource.capacity} units
                                                    <StatusChip>
                                                        Archived
                                                    </StatusChip>
                                                </p>
                                            ) : (
                                                <>
                                                    <ConfigForm
                                                        method="patch"
                                                        url={`${base}/resources/${resource.id}`}
                                                        title={`Edit resource ${resource.name}`}
                                                        submitLabel="Save resource"
                                                        variant="secondary"
                                                        inline
                                                        fields={[
                                                            NAME,
                                                            CAPACITY,
                                                            ACTIVE,
                                                        ]}
                                                        initial={{
                                                            name: resource.name,
                                                            capacity: String(
                                                                resource.capacity,
                                                            ),
                                                            is_active:
                                                                resource.isActive,
                                                        }}
                                                    />
                                                    <div>
                                                        <ConfirmAction
                                                            label="Archive"
                                                            ariaLabel={`Archive resource ${resource.name}`}
                                                            title={`Archive ${resource.name}?`}
                                                            description="The resource stops counting toward capacity and may make variants unavailable. Its history is kept."
                                                            confirmLabel="Archive resource"
                                                            url={`${base}/resources/${resource.id}/archive`}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <ConfigForm
                                    method="post"
                                    url={`${base}/resources`}
                                    title={`Add a resource to ${type.name}`}
                                    submitLabel="Add resource"
                                    resetOnSuccess
                                    inline
                                    fields={[
                                        { ...NAME, label: 'New resource name' },
                                        CAPACITY,
                                    ]}
                                    initial={{
                                        name: '',
                                        capacity: '1',
                                        resource_type_id: String(type.id),
                                    }}
                                />
                                <div>
                                    <ConfirmAction
                                        label="Archive resource type"
                                        ariaLabel={`Archive resource type ${type.name}`}
                                        title={`Archive ${type.name}?`}
                                        description="Variants consuming this type become unavailable. Its history is kept."
                                        confirmLabel="Archive resource type"
                                        url={`${base}/resource-types/${type.id}/archive`}
                                    />
                                </div>
                            </>
                        )}
                    </SectionCard>
                ))}
                <Card className="rounded-2xl shadow-none">
                    <CardContent>
                        <ConfigForm
                            method="post"
                            url={`${base}/resource-types`}
                            title="Add a resource type"
                            submitLabel="Add resource type"
                            resetOnSuccess
                            inline
                            fields={[{ ...NAME, label: 'New resource type' }]}
                            initial={{ name: '' }}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
