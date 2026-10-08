import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { AddOnForm } from '@/components/owner/catalog/add-on-form';
import type { AddOn } from '@/components/owner/catalog/add-on-form';
import type { ResourceTypeOption } from '@/components/owner/catalog/consumption-editor';
import { ServiceCard } from '@/components/owner/catalog/service-card';
import type { Service, Variant } from '@/components/owner/catalog/service-card';
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
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import type { OwnerPageProps } from '@/types/owner';

type VehicleType = {
    id: number;
    name: string;
    isActive: boolean;
    archived: boolean;
};

type Props = OwnerPageProps & {
    vehicleTypes: VehicleType[];
    services: Service[];
    addOns: AddOn[];
    resourceTypes: ResourceTypeOption[];
};

type Editor =
    | { kind: 'vehicle'; id: number }
    | { kind: 'service'; id: number }
    | { kind: 'addon'; id: number }
    | { kind: 'new-vehicle' }
    | { kind: 'new-service' }
    | { kind: 'new-addon' };

type VariantRow = { service: Service; variant: Variant };

const NAME_FIELD: ConfigField = {
    kind: 'text',
    name: 'name',
    label: 'Name',
    required: true,
    maxLength: 120,
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

function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function EditButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:h-11"
            aria-label={label}
            onClick={onClick}
        >
            <PencilIcon aria-hidden="true" />
            Edit
        </Button>
    );
}

export default function Services({
    organization,
    vehicleTypes,
    services,
    addOns,
    resourceTypes,
}: Props) {
    const base = organization.baseUrl;
    const [editor, setEditor] = useState<Editor | null>(null);
    const close = () => setEditor(null);
    const liveServices = services.filter((s) => !s.archived);
    const liveTypes = vehicleTypes.filter((t) => !t.archived);
    const resourceName = new Map(resourceTypes.map((t) => [t.id, t.name]));
    const variantRows: VariantRow[] = liveServices.flatMap((service) =>
        service.variants
            .filter((variant) => !variant.archived)
            .map((variant) => ({ service, variant })),
    );
    const editedVehicle =
        editor?.kind === 'vehicle'
            ? vehicleTypes.find((t) => t.id === editor.id)
            : undefined;
    const editedService =
        editor?.kind === 'service'
            ? services.find((s) => s.id === editor.id)
            : undefined;
    const editedAddOn =
        editor?.kind === 'addon'
            ? addOns.find((a) => a.id === editor.id)
            : undefined;

    const variantColumns: RecordColumn<VariantRow>[] = [
        {
            key: 'combination',
            header: 'Combination',
            cell: ({ service, variant }) => (
                <span className="font-semibold">
                    {service.name} · {variant.vehicleTypeName}
                </span>
            ),
        },
        {
            key: 'price',
            header: 'Price',
            cell: ({ variant }) => formatCentavos(variant.priceCentavos),
        },
        {
            key: 'duration',
            header: 'Duration',
            cell: ({ variant }) => formatMinutes(variant.durationMinutes),
        },
        {
            key: 'buffer',
            header: 'Buffer',
            cell: ({ variant }) => `${variant.bufferMinutes} min`,
        },
        {
            key: 'consumption',
            header: 'Consumption',
            cell: ({ variant }) =>
                variant.consumption.length === 0 ? (
                    <span className="font-medium text-destructive">
                        Missing
                    </span>
                ) : (
                    variant.consumption
                        .map(
                            (rule) =>
                                `${resourceName.get(rule.resourceTypeId) ?? 'Resource'} · ${rule.units}`,
                        )
                        .join(', ')
                ),
        },
        {
            key: 'state',
            header: 'State',
            cell: ({ variant }) =>
                variant.available ? (
                    <StatusChip tone="success">Bookable</StatusChip>
                ) : (
                    <StatusChip tone="warning">Unavailable</StatusChip>
                ),
        },
    ];

    return (
        <>
            <SettingsPageHeader section="services" />
            <div className="grid items-start gap-6 xl:grid-cols-5">
                <SectionCard
                    title="Vehicle types"
                    description={`Each service is priced per vehicle type. ${liveTypes.length} active.`}
                    contentClassName="grid gap-4"
                    className="xl:col-span-2"
                >
                    {vehicleTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No vehicle types yet. Add one to price your
                            services.
                        </p>
                    ) : null}
                    <ul aria-label="Vehicle types" className="grid gap-2">
                        {vehicleTypes.map((type) => (
                            <li
                                key={type.id}
                                className="flex items-center gap-3 rounded-xl border bg-card p-3"
                            >
                                <span className="min-w-0 flex-1 font-semibold">
                                    {type.name}
                                </span>
                                {stateChip(type)}
                                {type.archived ? null : (
                                    <EditButton
                                        label={`Edit vehicle type ${type.name}`}
                                        onClick={() =>
                                            setEditor({
                                                kind: 'vehicle',
                                                id: type.id,
                                            })
                                        }
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={() => setEditor({ kind: 'new-vehicle' })}
                        >
                            <PlusIcon aria-hidden="true" />
                            Add vehicle type
                        </Button>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Services"
                    description="Service definitions, status and availability windows. Edit a service to manage its variants and windows."
                    contentClassName="grid gap-4"
                    className="xl:col-span-3"
                >
                    {services.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No services yet. Add your first service.
                        </p>
                    ) : null}
                    <ul aria-label="Services" className="grid gap-2">
                        {services.map((service) => {
                            const live = service.variants.filter(
                                (variant) => !variant.archived,
                            );
                            const from = live.length
                                ? Math.min(...live.map((v) => v.priceCentavos))
                                : null;

                            return (
                                <li
                                    key={service.id}
                                    className="flex items-center gap-3 rounded-xl border bg-card p-3"
                                >
                                    <div className="grid min-w-0 flex-1 gap-0.5">
                                        <span className="font-semibold">
                                            {service.name}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {from === null
                                                ? 'No variants yet'
                                                : `${plural(live.length, 'variant')} · From ${formatCentavos(from)}`}
                                        </span>
                                    </div>
                                    {stateChip(service)}
                                    {service.archived ? null : (
                                        <EditButton
                                            label={`Edit service ${service.name}`}
                                            onClick={() =>
                                                setEditor({
                                                    kind: 'service',
                                                    id: service.id,
                                                })
                                            }
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            className="max-sm:h-11"
                            onClick={() => setEditor({ kind: 'new-service' })}
                        >
                            <PlusIcon aria-hidden="true" />
                            Add service
                        </Button>
                    </div>
                </SectionCard>

                {editor?.kind === 'new-vehicle' ? (
                    <EditorPanel
                        title="Add a vehicle type"
                        onClose={close}
                        className="xl:col-span-5"
                    >
                        <ConfigForm
                            method="post"
                            url={`${base}/vehicle-types`}
                            title="Add a vehicle type"
                            submitLabel="Add vehicle type"
                            resetOnSuccess
                            onSuccess={close}
                            inline
                            fields={[
                                { ...NAME_FIELD, label: 'New vehicle type' },
                            ]}
                            initial={{ name: '' }}
                        />
                    </EditorPanel>
                ) : null}

                {editor?.kind === 'new-service' ? (
                    <EditorPanel
                        title="Add a service"
                        onClose={close}
                        className="xl:col-span-5"
                    >
                        <ConfigForm
                            method="post"
                            url={`${base}/services`}
                            title="Add a service"
                            submitLabel="Add service"
                            resetOnSuccess
                            onSuccess={close}
                            fields={[
                                { ...NAME_FIELD, label: 'New service name' },
                                {
                                    kind: 'textarea',
                                    name: 'description',
                                    label: 'Description',
                                    maxLength: 1000,
                                },
                            ]}
                            initial={{ name: '', description: '' }}
                        />
                    </EditorPanel>
                ) : null}

                {editedVehicle && !editedVehicle.archived ? (
                    <EditorPanel
                        title={`Edit vehicle type ${editedVehicle.name}`}
                        onClose={close}
                        className="xl:col-span-5"
                    >
                        <ConfigForm
                            key={editedVehicle.id}
                            method="patch"
                            url={`${base}/vehicle-types/${editedVehicle.id}`}
                            title={`Edit vehicle type ${editedVehicle.name}`}
                            submitLabel="Save"
                            variant="secondary"
                            inline
                            fields={[
                                NAME_FIELD,
                                {
                                    kind: 'checkbox',
                                    name: 'is_active',
                                    label: 'Active',
                                },
                            ]}
                            initial={{
                                name: editedVehicle.name,
                                is_active: editedVehicle.isActive,
                            }}
                        />
                        <div>
                            <ConfirmAction
                                label="Archive"
                                ariaLabel={`Archive vehicle type ${editedVehicle.name}`}
                                title={`Archive ${editedVehicle.name}?`}
                                description="The vehicle type stops being offered. Variants using it become unavailable; history is kept."
                                confirmLabel="Archive vehicle type"
                                url={`${base}/vehicle-types/${editedVehicle.id}/archive`}
                            />
                        </div>
                    </EditorPanel>
                ) : null}

                {editedService && !editedService.archived ? (
                    <EditorPanel
                        title={`Edit service ${editedService.name}`}
                        onClose={close}
                        className="xl:col-span-5"
                    >
                        <ServiceCard
                            key={editedService.id}
                            baseUrl={base}
                            service={editedService}
                            vehicleTypes={vehicleTypes}
                            resourceTypes={resourceTypes}
                        />
                    </EditorPanel>
                ) : null}

                <SectionCard
                    title="Service + vehicle variants"
                    description="Price, duration, buffer, bookability and approved resource consumption are configured per variant."
                    className="max-md:hidden xl:col-span-3"
                >
                    <RecordTable
                        label="Service and vehicle variants"
                        columns={variantColumns}
                        rows={variantRows}
                        rowKey={({ variant }) => variant.id}
                        gridClassName="md:grid-cols-[2fr_1fr_1fr_1fr_1.6fr_1.2fr]"
                        emptyMessage="No variants yet. Edit a service to add a vehicle variant."
                    />
                </SectionCard>

                <SectionCard
                    title="Add-ons"
                    description="Optional extras. They change price and duration only; they never add resource consumption."
                    contentClassName="grid gap-4"
                    className="xl:col-span-2"
                >
                    {addOns.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No add-ons yet.
                        </p>
                    ) : null}
                    <ul aria-label="Add-ons" className="grid gap-2">
                        {addOns.map((addOn) => (
                            <li
                                key={addOn.id}
                                className="flex items-center gap-3 rounded-xl border bg-card p-3"
                            >
                                <div className="grid min-w-0 flex-1 gap-0.5">
                                    <span className="font-semibold">
                                        {addOn.name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatCentavos(addOn.priceCentavos)} ·
                                        +{addOn.durationMinutes} min
                                    </span>
                                </div>
                                {stateChip(addOn)}
                                {addOn.archived ? null : (
                                    <EditButton
                                        label={`Edit add-on ${addOn.name}`}
                                        onClick={() =>
                                            setEditor({
                                                kind: 'addon',
                                                id: addOn.id,
                                            })
                                        }
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                    {editor?.kind === 'new-addon' ? (
                        <EditorPanel
                            title="Add an add-on"
                            headingLevel="h3"
                            onClose={close}
                        >
                            <AddOnForm
                                method="post"
                                url={`${base}/add-ons`}
                                services={liveServices}
                                vehicleTypes={liveTypes}
                                submitLabel="Add add-on"
                                onSuccess={close}
                            />
                        </EditorPanel>
                    ) : null}
                    {editedAddOn && !editedAddOn.archived ? (
                        <EditorPanel
                            title={`Edit add-on ${editedAddOn.name}`}
                            headingLevel="h3"
                            onClose={close}
                        >
                            <AddOnForm
                                key={editedAddOn.id}
                                method="patch"
                                url={`${base}/add-ons/${editedAddOn.id}`}
                                addOn={editedAddOn}
                                services={liveServices}
                                vehicleTypes={liveTypes}
                                submitLabel="Save add-on"
                            />
                            <div>
                                <ConfirmAction
                                    label="Archive add-on"
                                    ariaLabel={`Archive add-on ${editedAddOn.name}`}
                                    title={`Archive ${editedAddOn.name}?`}
                                    description="The add-on stops being offered. Its history is kept."
                                    confirmLabel="Archive add-on"
                                    url={`${base}/add-ons/${editedAddOn.id}/archive`}
                                />
                            </div>
                        </EditorPanel>
                    ) : null}
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={() => setEditor({ kind: 'new-addon' })}
                        >
                            <PlusIcon aria-hidden="true" />
                            Add add-on
                        </Button>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Availability rule"
                    description="A service and vehicle variant without approved resource consumption is shown as unavailable with its reason, and cannot be booked."
                    className="xl:col-span-5"
                />
            </div>
        </>
    );
}
