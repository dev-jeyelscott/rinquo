import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { CheckboxField, TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import { centavosToPesos, pesosToCentavos } from '@/lib/money';

export type AddOn = {
    id: number;
    name: string;
    priceCentavos: number;
    durationMinutes: number;
    isActive: boolean;
    archived: boolean;
    serviceIds: number[];
    vehicleTypeIds: number[];
};

type Named = { id: number; name: string };

type Props = {
    url: string;
    method: 'post' | 'patch';
    addOn?: AddOn;
    services: Named[];
    vehicleTypes: Named[];
    submitLabel: string;
    /** Runs after the server accepts the form (for example to close its panel). */
    onSuccess?: () => void;
};

/** Create or edit an add-on with its service and vehicle compatibility. */
export function AddOnForm({
    url,
    method,
    addOn,
    services,
    vehicleTypes,
    submitLabel,
    onSuccess,
}: Props) {
    const form = useForm({
        name: addOn?.name ?? '',
        price: addOn ? centavosToPesos(addOn.priceCentavos) : '',
        duration_minutes: String(addOn?.durationMinutes ?? 0),
        is_active: addOn?.isActive ?? true,
        service_ids: addOn?.serviceIds ?? ([] as number[]),
        vehicle_type_ids: addOn?.vehicleTypeIds ?? ([] as number[]),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const title = addOn ? `Edit add-on ${addOn.name}` : 'Add an add-on';

    const toggle = (key: 'service_ids' | 'vehicle_type_ids', id: number) =>
        form.setData(
            key,
            form.data[key].includes(id)
                ? form.data[key].filter((value) => value !== id)
                : [...form.data[key], id],
        );

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform(({ price, ...data }) => ({
            ...data,
            price_centavos: pesosToCentavos(price) ?? '',
        }));
        form[method](url, {
            preserveScroll: true,
            onSuccess: () => {
                if (!addOn) {
                    form.reset();
                }
                onSuccess?.();
            },
        });
    }

    return (
        <form
            onSubmit={submit}
            aria-label={title}
            noValidate
            className="grid gap-3"
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                    label="Add-on name"
                    required
                    maxLength={120}
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    error={errors.name}
                />
                <TextField
                    label="Price (PHP)"
                    required
                    inputMode="decimal"
                    value={form.data.price}
                    onChange={(event) =>
                        form.setData('price', event.target.value)
                    }
                    error={errors.price_centavos}
                />
                <TextField
                    label="Extra minutes"
                    type="number"
                    min={0}
                    step={1}
                    value={form.data.duration_minutes}
                    onChange={(event) =>
                        form.setData('duration_minutes', event.target.value)
                    }
                    error={errors.duration_minutes}
                />
            </div>
            <fieldset className="grid gap-1">
                <legend className="text-sm font-medium">
                    Offered with services
                </legend>
                {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No services yet.
                    </p>
                ) : null}
                <div className="flex flex-wrap gap-x-4">
                    {services.map((service) => (
                        <CheckboxField
                            key={service.id}
                            label={service.name}
                            checked={form.data.service_ids.includes(service.id)}
                            onChange={() => toggle('service_ids', service.id)}
                        />
                    ))}
                </div>
                {errors.service_ids ? (
                    <p className="text-sm text-destructive">
                        {errors.service_ids}
                    </p>
                ) : null}
            </fieldset>
            <fieldset className="grid gap-1">
                <legend className="text-sm font-medium">
                    Compatible vehicle types
                </legend>
                {vehicleTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No vehicle types yet.
                    </p>
                ) : null}
                <div className="flex flex-wrap gap-x-4">
                    {vehicleTypes.map((type) => (
                        <CheckboxField
                            key={type.id}
                            label={type.name}
                            checked={form.data.vehicle_type_ids.includes(
                                type.id,
                            )}
                            onChange={() => toggle('vehicle_type_ids', type.id)}
                        />
                    ))}
                </div>
            </fieldset>
            {addOn ? (
                <CheckboxField
                    label="Active"
                    checked={form.data.is_active}
                    onChange={(event) =>
                        form.setData('is_active', event.target.checked)
                    }
                />
            ) : null}
            {errors.record ? (
                <p role="alert" className="text-sm text-destructive">
                    {errors.record}
                </p>
            ) : null}
            <div>
                <Button
                    type="submit"
                    size="sm"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? 'Saving...' : submitLabel}
                </Button>
            </div>
        </form>
    );
}
