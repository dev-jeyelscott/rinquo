import { useForm } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { FormEvent } from 'react';
import { SelectField, TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export type ResourceTypeOption = {
    id: number;
    name: string;
    largestCapacity: number;
};

type Row = { resource_type_id: string; units: string };

type Props = {
    url: string;
    variantLabel: string;
    resourceTypes: ResourceTypeOption[];
    consumption: { resourceTypeId: number; units: number }[];
};

/**
 * Edits which resource types a variant consumes and how many units. Missing
 * consumption means the variant is unavailable, never "zero".
 */
export function ConsumptionEditor({
    url,
    variantLabel,
    resourceTypes,
    consumption,
}: Props) {
    const form = useForm<{ rules: Row[] }>({
        rules: consumption.map((rule) => ({
            resource_type_id: String(rule.resourceTypeId),
            units: String(rule.units),
        })),
    });
    const errors = form.errors as Record<string, string | undefined>;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.put(url, { preserveScroll: true });
    }

    const update = (index: number, patch: Partial<Row>) =>
        form.setData(
            'rules',
            form.data.rules.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        );

    return (
        <form
            onSubmit={submit}
            aria-label={`Resource consumption for ${variantLabel}`}
            noValidate
            className="grid gap-3"
        >
            {errors.rules ? (
                <p role="alert" className="text-sm text-destructive">
                    {errors.rules}
                </p>
            ) : null}
            {resourceTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Add a resource type with a resource on the Resources tab
                    first.
                </p>
            ) : null}
            {form.data.rules.map((row, index) => (
                <div
                    key={index}
                    className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]"
                >
                    <SelectField
                        label={`${variantLabel}: resource ${index + 1}`}
                        placeholder="Choose a resource type"
                        value={row.resource_type_id}
                        options={resourceTypes.map((type) => ({
                            value: String(type.id),
                            label: `${type.name} (up to ${type.largestCapacity} units)`,
                        }))}
                        onChange={(event) =>
                            update(index, {
                                resource_type_id: event.target.value,
                            })
                        }
                        error={errors[`rules.${index}.resource_type_id`]}
                    />
                    <TextField
                        label="Units used"
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={row.units}
                        onChange={(event) =>
                            update(index, { units: event.target.value })
                        }
                        error={errors[`rules.${index}.units`]}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="max-sm:size-11"
                        aria-label={`Remove resource ${index + 1} from ${variantLabel}`}
                        onClick={() =>
                            form.setData(
                                'rules',
                                form.data.rules.filter((_, i) => i !== index),
                            )
                        }
                    >
                        <Trash2Icon aria-hidden="true" />
                    </Button>
                </div>
            ))}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={resourceTypes.length === 0}
                    onClick={() =>
                        form.setData('rules', [
                            ...form.data.rules,
                            { resource_type_id: '', units: '1' },
                        ])
                    }
                >
                    <PlusIcon aria-hidden="true" />
                    Add resource
                </Button>
                <Button
                    type="submit"
                    size="sm"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {form.processing ? 'Saving...' : 'Save consumption'}
                </Button>
            </div>
        </form>
    );
}
