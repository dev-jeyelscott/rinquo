import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField } from '@/components/owner/config-form';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { EditorPanel } from '@/components/owner/editor-panel';
import { RecordTable } from '@/components/owner/record-table';
import type { RecordColumn } from '@/components/owner/record-table';
import { SectionCard } from '@/components/owner/section-card';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
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

type Editor =
    | { kind: 'type'; id: number }
    | { kind: 'resource'; id: number }
    | { kind: 'new-type' }
    | { kind: 'new-resource' };

type Row = { resource: Resource; type: ResourceType };

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

function stateChip(item: { isActive: boolean; archived: boolean }) {
    return item.archived ? (
        <StatusChip>Archived</StatusChip>
    ) : (
        <StatusChip tone={item.isActive ? 'success' : 'neutral'}>
            {item.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
    );
}

function units(count: number) {
    return `${count} ${count === 1 ? 'unit' : 'units'}`;
}

export default function Resources({ organization, resourceTypes }: Props) {
    const base = organization.baseUrl;
    const [editor, setEditor] = useState<Editor | null>(null);
    const close = () => setEditor(null);
    const liveTypes = resourceTypes.filter((type) => !type.archived);
    const rows: Row[] = resourceTypes.flatMap((type) =>
        type.resources.map((resource) => ({ resource, type })),
    );
    const editedType =
        editor?.kind === 'type'
            ? resourceTypes.find((type) => type.id === editor.id)
            : undefined;
    const editedRow =
        editor?.kind === 'resource'
            ? rows.find((row) => row.resource.id === editor.id)
            : undefined;

    const columns: RecordColumn<Row>[] = [
        {
            key: 'resource',
            header: 'Resource',
            cell: ({ resource }) => (
                <span className="font-semibold">{resource.name}</span>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            mobileClassName:
                'max-md:col-span-2 max-md:row-start-2 text-muted-foreground',
            cell: ({ type, resource }) => (
                <>
                    {type.name}
                    <span className="md:hidden">
                        {' · '}
                        {units(resource.capacity)}
                    </span>
                </>
            ),
        },
        {
            key: 'capacity',
            header: 'Capacity',
            mobileClassName: 'max-md:hidden',
            cell: ({ resource }) => units(resource.capacity),
        },
        {
            key: 'state',
            header: 'State',
            mobileClassName:
                'max-md:col-start-2 max-md:row-start-1 max-md:justify-self-end',
            cell: ({ resource }) => stateChip(resource),
        },
        {
            key: 'actions',
            header: 'Actions',
            srOnlyHeader: true,
            mobileClassName: 'max-md:col-span-2 max-md:row-start-3',
            cell: ({ resource }) =>
                resource.archived ? null : (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-md:h-11"
                        aria-label={`Edit resource ${resource.name}`}
                        onClick={() =>
                            setEditor({ kind: 'resource', id: resource.id })
                        }
                    >
                        <PencilIcon aria-hidden="true" />
                        Edit
                    </Button>
                ),
        },
    ];

    return (
        <>
            <SettingsPageHeader section="resources" />
            <div className="grid items-start gap-6 xl:grid-cols-[2fr_3fr]">
                <SectionCard
                    title="Resource types"
                    description="Physical scheduling resource categories, for example a wash bay. Resources are not staff."
                    contentClassName="grid gap-4"
                >
                    {resourceTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No resource types yet. Add your first one to start
                            adding resources.
                        </p>
                    ) : null}
                    <ul aria-label="Resource types" className="grid gap-3">
                        {resourceTypes.map((type) => (
                            <li
                                key={type.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card p-3"
                            >
                                <div className="grid min-w-0 flex-1 gap-0.5">
                                    <span className="font-semibold">
                                        {type.name}
                                    </span>
                                    {type.archived ? null : (
                                        <span className="text-sm text-muted-foreground">
                                            {type.resources.length === 0
                                                ? 'No resources yet. Variants using this type stay unavailable.'
                                                : `${type.resources.length} ${type.resources.length === 1 ? 'resource' : 'resources'}`}
                                        </span>
                                    )}
                                </div>
                                {stateChip(type)}
                                {type.archived ? null : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="max-sm:h-11"
                                        aria-label={`Edit resource type ${type.name}`}
                                        onClick={() =>
                                            setEditor({
                                                kind: 'type',
                                                id: type.id,
                                            })
                                        }
                                    >
                                        <PencilIcon aria-hidden="true" />
                                        Edit
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={() => setEditor({ kind: 'new-type' })}
                        >
                            <PlusIcon aria-hidden="true" />
                            Add resource type
                        </Button>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Named physical resources"
                    description="Availability requires one compatible active physical resource with enough capacity."
                    contentClassName="grid gap-4"
                >
                    <RecordTable
                        label="Named physical resources"
                        columns={columns}
                        rows={rows}
                        rowKey={(row) => row.resource.id}
                        gridClassName="md:grid-cols-[2fr_1.5fr_1fr_1fr_auto]"
                        emptyMessage="No physical resources yet. Add one so variants can be booked."
                    />
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            className="max-sm:h-11"
                            disabled={liveTypes.length === 0}
                            onClick={() => setEditor({ kind: 'new-resource' })}
                        >
                            <PlusIcon aria-hidden="true" />
                            Add resource
                        </Button>
                    </div>
                    {liveTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Add a resource type first.
                        </p>
                    ) : null}
                </SectionCard>

                {editor?.kind === 'new-type' ? (
                    <EditorPanel
                        title="Add a resource type"
                        onClose={close}
                        className="xl:col-span-2"
                    >
                        <ConfigForm
                            method="post"
                            url={`${base}/resource-types`}
                            title="Add a resource type"
                            submitLabel="Add resource type"
                            resetOnSuccess
                            onSuccess={close}
                            inline
                            fields={[{ ...NAME, label: 'New resource type' }]}
                            initial={{ name: '' }}
                        />
                    </EditorPanel>
                ) : null}

                {editor?.kind === 'new-resource' ? (
                    <EditorPanel
                        title="Add a physical resource"
                        onClose={close}
                        className="xl:col-span-2"
                    >
                        <ConfigForm
                            method="post"
                            url={`${base}/resources`}
                            title="Add a physical resource"
                            submitLabel="Add resource"
                            resetOnSuccess
                            onSuccess={close}
                            inline
                            fields={[
                                {
                                    kind: 'select',
                                    name: 'resource_type_id',
                                    label: 'Resource type',
                                    required: true,
                                    placeholder: 'Choose a resource type',
                                    options: liveTypes.map((type) => ({
                                        value: String(type.id),
                                        label: type.name,
                                    })),
                                },
                                { ...NAME, label: 'New resource name' },
                                CAPACITY,
                            ]}
                            initial={{
                                resource_type_id: '',
                                name: '',
                                capacity: '1',
                            }}
                        />
                    </EditorPanel>
                ) : null}

                {editedType && !editedType.archived ? (
                    <EditorPanel
                        title={`Edit resource type ${editedType.name}`}
                        onClose={close}
                        className="xl:col-span-2"
                    >
                        <ConfigForm
                            key={editedType.id}
                            method="patch"
                            url={`${base}/resource-types/${editedType.id}`}
                            title={`Edit resource type ${editedType.name}`}
                            submitLabel="Save resource type"
                            variant="secondary"
                            inline
                            fields={[NAME, ACTIVE]}
                            initial={{
                                name: editedType.name,
                                is_active: editedType.isActive,
                            }}
                        />
                        <div>
                            <ConfirmAction
                                label="Archive resource type"
                                ariaLabel={`Archive resource type ${editedType.name}`}
                                title={`Archive ${editedType.name}?`}
                                description="Variants consuming this type become unavailable. Its history is kept."
                                confirmLabel="Archive resource type"
                                url={`${base}/resource-types/${editedType.id}/archive`}
                            />
                        </div>
                    </EditorPanel>
                ) : null}

                {editedRow && !editedRow.resource.archived ? (
                    <EditorPanel
                        title={`Edit resource ${editedRow.resource.name}`}
                        onClose={close}
                        className="xl:col-span-2"
                    >
                        <ConfigForm
                            key={editedRow.resource.id}
                            method="patch"
                            url={`${base}/resources/${editedRow.resource.id}`}
                            title={`Edit resource ${editedRow.resource.name}`}
                            submitLabel="Save resource"
                            variant="secondary"
                            inline
                            fields={[NAME, CAPACITY, ACTIVE]}
                            initial={{
                                name: editedRow.resource.name,
                                capacity: String(editedRow.resource.capacity),
                                is_active: editedRow.resource.isActive,
                            }}
                        />
                        <div>
                            <ConfirmAction
                                label="Archive"
                                ariaLabel={`Archive resource ${editedRow.resource.name}`}
                                title={`Archive ${editedRow.resource.name}?`}
                                description="The resource stops counting toward capacity and may make variants unavailable. Its history is kept."
                                confirmLabel="Archive resource"
                                url={`${base}/resources/${editedRow.resource.id}/archive`}
                            />
                        </div>
                    </EditorPanel>
                ) : null}
            </div>
        </>
    );
}
