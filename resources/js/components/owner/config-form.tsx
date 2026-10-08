import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import {
    CheckboxField,
    SelectField,
    TextareaField,
    TextField,
} from '@/components/owner/form-field';
import type { SelectOption } from '@/components/owner/form-field';
import { SectionCard } from '@/components/owner/section-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { pesosToCentavos } from '@/lib/money';

type Base = {
    name: string;
    label: string;
    hint?: string;
    required?: boolean;
    /** Span both columns of a grouped card. */
    wide?: boolean;
};

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
    | (Base & { kind: 'checkbox' })
    /** Read-only context shown beside editable fields; never part of the payload. */
    | (Base & { kind: 'static'; value: string });

/** A titled card of related fields inside one form (one submit, one payload). */
export type ConfigGroup = {
    title: string;
    description?: string;
    /** Names of the fields shown in this card, in order. */
    fields: string[];
};

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
    /** Split the fields into titled cards; the submit action follows the last card. */
    groups?: ConfigGroup[];
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
    groups,
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

    function renderField(field: ConfigField) {
        const value = form.data[field.name];
        if (field.kind === 'static') {
            return (
                <TextField
                    key={field.name}
                    label={field.label}
                    hint={field.hint}
                    value={field.value}
                    readOnly
                    aria-readonly="true"
                    className={cn(
                        '[&_input]:bg-muted [&_input]:text-muted-foreground',
                        field.wide && 'sm:col-span-2',
                    )}
                />
            );
        }
        const common = {
            label: field.label,
            hint: field.hint,
            error: error(field.name),
            className: field.wide ? 'sm:col-span-2' : undefined,
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
                            field.kind === 'text' ? field.maxLength : undefined,
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
    }

    return (
        <form
            onSubmit={submit}
            aria-label={title}
            noValidate
            className={cn(
                groups ? 'grid gap-6' : 'grid gap-3',
                inline &&
                    'items-end sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]',
            )}
        >
            {groups
                ? groups.map((group) => (
                      <SectionCard
                          key={group.title}
                          title={group.title}
                          description={group.description}
                          contentClassName="grid gap-4 sm:grid-cols-2"
                      >
                          {group.fields.map((name) => {
                              const field = fields.find(
                                  (candidate) => candidate.name === name,
                              );

                              return field ? renderField(field) : null;
                          })}
                      </SectionCard>
                  ))
                : fields.map(renderField)}
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
