import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField } from '@/components/owner/config-form';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { ConsumptionEditor } from '@/components/owner/catalog/consumption-editor';
import type { ResourceTypeOption } from '@/components/owner/catalog/consumption-editor';
import { WindowsForm } from '@/components/owner/catalog/windows-form';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { reasonLabel } from '@/lib/availability';
import { centavosToPesos, formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';

export type Variant = {
    id: number;
    vehicleTypeId: number;
    vehicleTypeName: string | null;
    priceCentavos: number;
    durationMinutes: number;
    bufferMinutes: number;
    isActive: boolean;
    archived: boolean;
    consumption: { resourceTypeId: number; units: number }[];
    available: boolean;
    reasons: string[];
};

export type Service = {
    id: number;
    name: string;
    description: string;
    isActive: boolean;
    archived: boolean;
    windows: { weekday: number; startsAt: string; endsAt: string }[];
    variants: Variant[];
};

type Props = {
    baseUrl: string;
    service: Service;
    vehicleTypes: { id: number; name: string; archived: boolean }[];
    resourceTypes: ResourceTypeOption[];
};

const SERVICE_FIELDS: ConfigField[] = [
    {
        kind: 'text',
        name: 'name',
        label: 'Service name',
        required: true,
        maxLength: 120,
    },
    {
        kind: 'textarea',
        name: 'description',
        label: 'Description',
        maxLength: 1000,
    },
    { kind: 'checkbox', name: 'is_active', label: 'Active' },
];

const VARIANT_FIELDS: ConfigField[] = [
    {
        kind: 'money',
        name: 'price_centavos',
        label: 'Price (PHP)',
        required: true,
    },
    {
        kind: 'number',
        name: 'duration_minutes',
        label: 'Duration (minutes)',
        required: true,
        min: 1,
        max: 1440,
    },
    {
        kind: 'number',
        name: 'buffer_minutes',
        label: 'Buffer after (minutes)',
        min: 0,
        max: 480,
    },
    { kind: 'checkbox', name: 'is_active', label: 'Active' },
];

/** One service with its windows, vehicle variants and per-variant consumption. */
export function ServiceCard({
    baseUrl,
    service,
    vehicleTypes,
    resourceTypes,
}: Props) {
    const serviceUrl = `${baseUrl}/services/${service.id}`;
    const usedTypes = new Set(service.variants.map((v) => v.vehicleTypeId));
    const addable = vehicleTypes.filter(
        (t) => !t.archived && !usedTypes.has(t.id),
    );

    return (
        <SectionCard
            role="group"
            aria-label={service.name}
            title={service.name}
            headingLevel="h3"
            description={
                service.archived
                    ? 'Archived services keep their history and are not offered.'
                    : undefined
            }
            contentClassName="grid gap-6"
            badge={
                service.archived ? (
                    <StatusChip>Archived</StatusChip>
                ) : (
                    <StatusChip tone={service.isActive ? 'success' : 'neutral'}>
                        {service.isActive ? 'Active' : 'Inactive'}
                    </StatusChip>
                )
            }
        >
            {service.archived ? null : (
                <>
                    <ConfigForm
                        method="patch"
                        url={serviceUrl}
                        title={`Edit service ${service.name}`}
                        submitLabel="Save service"
                        variant="secondary"
                        fields={SERVICE_FIELDS}
                        initial={{
                            name: service.name,
                            description: service.description,
                            is_active: service.isActive,
                        }}
                    />
                    <section
                        aria-label={`Windows for ${service.name}`}
                        className="grid gap-2"
                    >
                        <h4 className="font-medium">Service windows</h4>
                        <WindowsForm
                            url={`${serviceUrl}/windows`}
                            serviceName={service.name}
                            windows={service.windows}
                        />
                    </section>
                    <section
                        aria-label={`Variants of ${service.name}`}
                        className="grid gap-4"
                    >
                        <h4 className="font-medium">Vehicle variants</h4>
                        {service.variants.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No variants yet. Add a vehicle type with a price
                                and duration.
                            </p>
                        ) : null}
                        {service.variants.map((variant) => {
                            const label = `${service.name} for ${variant.vehicleTypeName}`;

                            return (
                                <div
                                    key={variant.id}
                                    className="grid gap-3 rounded-xl border bg-card p-3"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">
                                            {variant.vehicleTypeName}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {formatCentavos(
                                                variant.priceCentavos,
                                            )}{' '}
                                            ·{' '}
                                            {formatMinutes(
                                                variant.durationMinutes,
                                            )}
                                            {variant.bufferMinutes > 0
                                                ? ` + ${variant.bufferMinutes} min buffer`
                                                : ''}
                                        </span>
                                        {variant.archived ? (
                                            <StatusChip>Archived</StatusChip>
                                        ) : variant.available ? (
                                            <StatusChip tone="success">
                                                Bookable
                                            </StatusChip>
                                        ) : (
                                            <StatusChip tone="warning">
                                                Unavailable
                                            </StatusChip>
                                        )}
                                    </div>
                                    {variant.archived ||
                                    variant.available ? null : (
                                        <ul
                                            aria-label={`Why ${label} is unavailable`}
                                            className="list-disc pl-5 text-sm text-warning"
                                        >
                                            {variant.reasons.map((reason) => (
                                                <li key={reason}>
                                                    {reasonLabel(reason)}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {variant.archived ? null : (
                                        <>
                                            <ConfigForm
                                                method="patch"
                                                url={`${serviceUrl}/variants/${variant.id}`}
                                                title={`Edit ${label}`}
                                                submitLabel="Save variant"
                                                variant="secondary"
                                                inline
                                                fields={VARIANT_FIELDS}
                                                initial={{
                                                    price_centavos:
                                                        centavosToPesos(
                                                            variant.priceCentavos,
                                                        ),
                                                    duration_minutes: String(
                                                        variant.durationMinutes,
                                                    ),
                                                    buffer_minutes: String(
                                                        variant.bufferMinutes,
                                                    ),
                                                    is_active: variant.isActive,
                                                }}
                                            />
                                            <ConsumptionEditor
                                                url={`${serviceUrl}/variants/${variant.id}/consumption`}
                                                variantLabel={label}
                                                resourceTypes={resourceTypes}
                                                consumption={
                                                    variant.consumption
                                                }
                                            />
                                            <div>
                                                <ConfirmAction
                                                    label="Archive variant"
                                                    ariaLabel={`Archive ${label}`}
                                                    title={`Archive ${label}?`}
                                                    description="The variant stops being offered. Its history and id are kept."
                                                    confirmLabel="Archive variant"
                                                    url={`${serviceUrl}/variants/${variant.id}/archive`}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {addable.length > 0 ? (
                            <ConfigForm
                                method="post"
                                url={`${serviceUrl}/variants`}
                                title={`Add a vehicle variant to ${service.name}`}
                                submitLabel="Add variant"
                                resetOnSuccess
                                inline
                                fields={[
                                    {
                                        kind: 'select',
                                        name: 'vehicle_type_id',
                                        label: 'Vehicle type',
                                        required: true,
                                        placeholder: 'Choose a vehicle type',
                                        options: addable.map((t) => ({
                                            value: String(t.id),
                                            label: t.name,
                                        })),
                                    },
                                    ...VARIANT_FIELDS.filter(
                                        (f) => f.name !== 'is_active',
                                    ),
                                ]}
                                initial={{
                                    vehicle_type_id: '',
                                    price_centavos: '',
                                    duration_minutes: '60',
                                    buffer_minutes: '0',
                                }}
                            />
                        ) : null}
                    </section>
                    <div>
                        <ConfirmAction
                            label="Archive service"
                            ariaLabel={`Archive service ${service.name}`}
                            title={`Archive ${service.name}?`}
                            description="The service stops being offered and may make your shop unready. Its history and id are kept."
                            confirmLabel="Archive service"
                            url={`${serviceUrl}/archive`}
                        />
                    </div>
                </>
            )}
        </SectionCard>
    );
}
