import { Head } from '@inertiajs/react';
import { AddOnForm } from '@/components/owner/catalog/add-on-form';
import type { AddOn } from '@/components/owner/catalog/add-on-form';
import type { ResourceTypeOption } from '@/components/owner/catalog/consumption-editor';
import { ServiceCard } from '@/components/owner/catalog/service-card';
import type { Service } from '@/components/owner/catalog/service-card';
import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField } from '@/components/owner/config-form';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { Card, CardContent } from '@/components/ui/card';
import { formatCentavos } from '@/lib/money';
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

const NAME_FIELD: ConfigField = {
    kind: 'text',
    name: 'name',
    label: 'Name',
    required: true,
    maxLength: 120,
};

export default function Services({
    organization,
    vehicleTypes,
    services,
    addOns,
    resourceTypes,
}: Props) {
    const base = organization.baseUrl;
    const liveServices = services.filter((s) => !s.archived);
    const liveTypes = vehicleTypes.filter((t) => !t.archived);

    return (
        <>
            <Head title="Services" />
            <div className="grid gap-6">
                <SectionCard
                    title="Vehicle types"
                    description="Each service is priced per vehicle type."
                    contentClassName="grid gap-4"
                >
                    {vehicleTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No vehicle types yet. Add one to price your
                            services.
                        </p>
                    ) : null}
                    <ul className="grid gap-3">
                        {vehicleTypes.map((type) => (
                            <li
                                key={type.id}
                                className="rounded-xl border bg-card p-3"
                            >
                                {type.archived ? (
                                    <p className="flex items-center gap-2 text-sm">
                                        {type.name}
                                        <StatusChip>Archived</StatusChip>
                                    </p>
                                ) : (
                                    <div className="grid gap-2">
                                        <ConfigForm
                                            method="patch"
                                            url={`${base}/vehicle-types/${type.id}`}
                                            title={`Edit vehicle type ${type.name}`}
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
                                                name: type.name,
                                                is_active: type.isActive,
                                            }}
                                        />
                                        <div>
                                            <ConfirmAction
                                                label="Archive"
                                                ariaLabel={`Archive vehicle type ${type.name}`}
                                                title={`Archive ${type.name}?`}
                                                description="The vehicle type stops being offered. Variants using it become unavailable; history is kept."
                                                confirmLabel="Archive vehicle type"
                                                url={`${base}/vehicle-types/${type.id}/archive`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                    <ConfigForm
                        method="post"
                        url={`${base}/vehicle-types`}
                        title="Add a vehicle type"
                        submitLabel="Add vehicle type"
                        resetOnSuccess
                        inline
                        fields={[{ ...NAME_FIELD, label: 'New vehicle type' }]}
                        initial={{ name: '' }}
                    />
                </SectionCard>

                <section
                    aria-labelledby="services-heading"
                    className="grid gap-4"
                >
                    <h2
                        id="services-heading"
                        className="text-xl font-semibold tracking-tight"
                    >
                        Services
                    </h2>
                    {services.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No services yet. Add your first service below.
                        </p>
                    ) : null}
                    {services.map((service) => (
                        <ServiceCard
                            key={service.id}
                            baseUrl={base}
                            service={service}
                            vehicleTypes={vehicleTypes}
                            resourceTypes={resourceTypes}
                        />
                    ))}
                    <Card className="rounded-2xl shadow-none">
                        <CardContent>
                            <ConfigForm
                                method="post"
                                url={`${base}/services`}
                                title="Add a service"
                                submitLabel="Add service"
                                resetOnSuccess
                                fields={[
                                    {
                                        ...NAME_FIELD,
                                        label: 'New service name',
                                    },
                                    {
                                        kind: 'textarea',
                                        name: 'description',
                                        label: 'Description',
                                        maxLength: 1000,
                                    },
                                ]}
                                initial={{ name: '', description: '' }}
                            />
                        </CardContent>
                    </Card>
                </section>

                <SectionCard
                    title="Add-ons"
                    description="Optional extras. They change price and duration only; they never add resource consumption."
                    contentClassName="grid gap-4"
                >
                    {addOns.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No add-ons yet.
                        </p>
                    ) : null}
                    {addOns.map((addOn) => (
                        <div
                            key={addOn.id}
                            className="grid gap-3 rounded-xl border bg-card p-3"
                        >
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                                {addOn.name}
                                <span className="text-sm font-normal text-muted-foreground">
                                    {formatCentavos(addOn.priceCentavos)} · +
                                    {addOn.durationMinutes} min
                                </span>
                                {addOn.archived ? (
                                    <StatusChip>Archived</StatusChip>
                                ) : null}
                            </p>
                            {addOn.archived ? null : (
                                <>
                                    <AddOnForm
                                        method="patch"
                                        url={`${base}/add-ons/${addOn.id}`}
                                        addOn={addOn}
                                        services={liveServices}
                                        vehicleTypes={liveTypes}
                                        submitLabel="Save add-on"
                                    />
                                    <div>
                                        <ConfirmAction
                                            label="Archive add-on"
                                            ariaLabel={`Archive add-on ${addOn.name}`}
                                            title={`Archive ${addOn.name}?`}
                                            description="The add-on stops being offered. Its history is kept."
                                            confirmLabel="Archive add-on"
                                            url={`${base}/add-ons/${addOn.id}/archive`}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    <AddOnForm
                        method="post"
                        url={`${base}/add-ons`}
                        services={liveServices}
                        vehicleTypes={liveTypes}
                        submitLabel="Add add-on"
                    />
                </SectionCard>
            </div>
        </>
    );
}
