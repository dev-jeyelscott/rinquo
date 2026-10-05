import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<
    ComponentProps<'input'>,
    'type' | 'className' | 'children'
> & {
    type: 'radio' | 'checkbox';
    children: ReactNode;
    className?: string;
};

/**
 * A selectable card around a native radio or checkbox (vehicle, service and
 * add-on choices). The native control stays in the accessibility tree, so
 * keyboard use, grouping and announcements come from the platform; the card
 * only draws the checked and focus states. Selection is never colour alone:
 * the control keeps its own checked state and a check mark is drawn.
 */
export function ChoiceCard({ type, children, className, ...input }: Props) {
    return (
        <label className={cn('relative block cursor-pointer', className)}>
            <input type={type} className="peer sr-only" {...input} />
            <span className="grid min-h-11 gap-1 rounded-2xl border bg-card p-4 text-card-foreground transition-[color,box-shadow] peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:opacity-50">
                {children}
            </span>
        </label>
    );
}
