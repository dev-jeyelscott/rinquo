import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldProps = {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    className?: string;
};

const controlClass =
    'border-input placeholder:text-muted-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm';

/**
 * Persistent label, optional hint and an associated error message around one
 * control. The control receives aria-invalid and aria-describedby so screen
 * readers announce the error with the field.
 */
function Shell({
    label,
    error,
    hint,
    required,
    className,
    render,
}: FieldProps & {
    render: (aria: {
        id: string;
        'aria-invalid': boolean | undefined;
        'aria-describedby': string | undefined;
        'aria-required': boolean | undefined;
    }) => ReactNode;
}) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy =
        [hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined;

    return (
        <div className={cn('grid gap-1.5', className)}>
            {label ? (
                <Label htmlFor={id}>
                    {label}
                    {required ? (
                        <span aria-hidden="true" className="text-destructive">
                            {' '}
                            *
                        </span>
                    ) : null}
                </Label>
            ) : null}
            {render({
                id,
                'aria-invalid': error ? true : undefined,
                'aria-describedby': describedBy,
                'aria-required': required || undefined,
            })}
            {hint ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            ) : null}
            {error ? (
                <p id={errorId} className="text-sm text-destructive">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export function TextField({
    label,
    error,
    hint,
    required,
    className,
    ...input
}: FieldProps & Omit<ComponentProps<'input'>, 'className' | 'id'>) {
    return (
        <Shell
            {...{ label, error, hint, required, className }}
            render={(aria) => <Input {...aria} {...input} />}
        />
    );
}

export function TextareaField({
    label,
    error,
    hint,
    required,
    className,
    ...textarea
}: FieldProps & Omit<ComponentProps<'textarea'>, 'className' | 'id'>) {
    return (
        <Shell
            {...{ label, error, hint, required, className }}
            render={(aria) => (
                <textarea
                    rows={3}
                    {...aria}
                    {...textarea}
                    className={controlClass}
                />
            )}
        />
    );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
    label,
    error,
    hint,
    required,
    className,
    options,
    placeholder,
    ...select
}: FieldProps &
    Omit<ComponentProps<'select'>, 'className' | 'id'> & {
        options: SelectOption[];
        placeholder?: string;
    }) {
    return (
        <Shell
            {...{ label, error, hint, required, className }}
            render={(aria) => (
                <select
                    {...aria}
                    {...select}
                    className={cn(controlClass, 'h-9')}
                >
                    {placeholder ? (
                        <option value="">{placeholder}</option>
                    ) : null}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
        />
    );
}

export function CheckboxField({
    label,
    error,
    hint,
    className,
    ...input
}: Omit<FieldProps, 'required'> &
    Omit<ComponentProps<'input'>, 'className' | 'id' | 'type'>) {
    return (
        <Shell
            {...{ label: '', error, hint, className }}
            render={(aria) => (
                <label
                    htmlFor={aria.id}
                    className="flex min-h-9 items-center gap-2 text-sm font-medium"
                >
                    <input
                        {...aria}
                        {...input}
                        type="checkbox"
                        className="size-4 accent-primary"
                    />
                    {label}
                </label>
            )}
        />
    );
}
