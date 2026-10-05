import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import {
    CheckboxField,
    SelectField,
    TextareaField,
    TextField,
} from '@/components/owner/form-field';
import type { SelectOption } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { pesosToCentavos } from '@/lib/money';

type Base = { name: string; label: string; hint?: string; required?: boolean };

export type ConfigField =
    | (Base & {
          kind: 'text' | 'time' | 'date';
          maxLength?: number;
          className?: string;
      })
    | (Base & { kind: 'number'; min?: number; max?: number; step?: number })
    /** Whole pesos or pesos with centavos; submitted as integer centavos. */
    | (Base & { kind: 'money' })
    | (Base & { kind: 'textarea'; maxLength?: number })
    | (Base & {
          kind: 'select';
          options: SelectOption[];
          placeholder?: string;
      })
    | (Base & { kind: 'checkbox' });

type Values = Record<string, string | boolean>;

type Props = {
    method: 'post' | 'patch' | 'put';
    url: string;
    fields: ConfigField[];
    initial: Values;
    submitLabel: string;
    /** Accessible name of the form region. */
    title: string;
    resetOnSuccess?: boolean;
    variant?: 'default' | 'outline' | 'secondary';
    /** Lay fields out in a responsive row (used for inline create forms). */
    inline?: boolean;
    onSuccess?: () => void;
};

function toPayload(fields: ConfigField[], values: Values): Values {
    const payload: Record<string, string | boolean | number> = { ...values };

    for (const field of fields) {
        const value = values[field.name];

        if (field.kind === 'money' && typeof value === 'string') {
            const centavos = pesosToCentavos(value);
            payload[field.name] = centavos === null ? '' : centavos;
        }
    }

    return payload as Values;
}

/**
 * A small, accessible form driven by a field list. It owns submission state
 * (disabled and busy while processing), shows server validation errors next to
 * their fields and never decides authorization: the server policy does.
 */
export function ConfigForm({
    method,
    url,
    fields,
    initial,
    submitLabel,
    title,
    resetOnSuccess = false,
    variant = 'default',
    inline = false,
    onSuccess,
}: Props) {
    const form = useForm<Values>(initial);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => toPayload(fields, data));
        form[method](url, {
            preserveScroll: true,
            onSuccess: () => {
                if (resetOnSuccess) {
                    form.reset();
                }
                onSuccess?.();
            },
        });
    }

    const error = (name: string) =>
        (form.errors as Record<string, string | undefined>)[name];

    return (
        <form
            onSubmit={submit}
            aria-label={title}
            noValidate
            className={cn(
                'grid gap-3',
                inline &&
                    'items-end sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]',
            )}
        >
            {fields.map((field) => {
                const value = form.data[field.name];
                const common = {
                    label: field.label,
                    hint: field.hint,
                    error: error(field.name),
                };

                if (field.kind === 'checkbox') {
                    return (
                        <CheckboxField
                            key={field.name}
                            {...common}
                            checked={Boolean(value)}
                            onChange={(event) =>
                                form.setData(field.name, event.target.checked)
                            }
                        />
                    );
                }
                if (field.kind === 'select') {
                    return (
                        <SelectField
                            key={field.name}
                            {...common}
                            required={field.required}
                            options={field.options}
                            placeholder={field.placeholder}
                            value={String(value ?? '')}
                            onChange={(event) =>
                                form.setData(field.name, event.target.value)
                            }
                        />
                    );
                }
                if (field.kind === 'textarea') {
                    return (
                        <TextareaField
                            key={field.name}
                            {...common}
                            required={field.required}
                            maxLength={field.maxLength}
                            value={String(value ?? '')}
                            onChange={(event) =>
                                form.setData(field.name, event.target.value)
                            }
                        />
                    );
                }

                const inputProps =
                    field.kind === 'number'
                        ? {
                              type: 'number',
                              inputMode: 'numeric' as const,
                              min: field.min,
                              max: field.max,
                              step: field.step ?? 1,
                          }
                        : field.kind === 'money'
                          ? { type: 'text', inputMode: 'decimal' as const }
                          : {
                                type: field.kind,
                                maxLength:
                                    field.kind === 'text'
                                        ? field.maxLength
                                        : undefined,
                            };

                return (
                    <TextField
                        key={field.name}
                        {...common}
                        {...inputProps}
                        required={field.required}
                        value={String(value ?? '')}
                        onChange={(event) =>
                            form.setData(field.name, event.target.value)
                        }
                    />
                );
            })}
            <div className={cn(inline ? 'sm:self-end' : '')}>
                <Button
                    type="submit"
                    variant={variant}
                    className="max-sm:h-11"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : null}
                    {form.processing ? 'Saving...' : submitLabel}
                </Button>
            </div>
        </form>
    );
}
