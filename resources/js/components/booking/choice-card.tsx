import { CheckIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<
    ComponentProps<'input'>,
    'type' | 'className' | 'children'
> & {
    type: 'radio' | 'checkbox';
    children: ReactNode;
    /** Decorative glyph shown in a tinted tile before the content. */
    icon?: ReactNode;
    /** Content aligned to the trailing edge, before the indicator (a price, a duration). */
    aside?: ReactNode;
    className?: string;
};

/**
 * A selectable card around a native radio or checkbox (vehicle, service and
 * add-on choices). The native control stays in the accessibility tree, so
 * keyboard use, grouping and announcements come from the platform; the card
 * draws the checked and focus states. Selection is never colour alone: a
 * trailing indicator fills and shows a check mark besides the tinted surface
 * and ring. The outer ring is the card's rounded-2xl radius, so the focus ring
 * stays concentric with the surface.
 */
export function ChoiceCard({
    type,
    children,
    icon,
    aside,
    className,
    ...input
}: Props) {
    return (
        <label className={cn('relative block cursor-pointer', className)}>
            <input type={type} className="peer sr-only" {...input} />
            <span className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-3 text-card-foreground transition-[color,box-shadow] peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:opacity-50 sm:p-4 peer-checked:[&_[data-indicator]]:border-primary peer-checked:[&_[data-indicator]]:bg-primary peer-checked:[&_[data-indicator]]:text-primary-foreground">
                {icon ? (
                    <span
                        aria-hidden="true"
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                    >
                        {icon}
                    </span>
                ) : null}
                <span className="grid min-w-0 flex-1 gap-0.5">{children}</span>
                {aside ? (
                    <span className="grid shrink-0 justify-items-end gap-0.5 text-right">
                        {aside}
                    </span>
                ) : null}
                <span
                    aria-hidden="true"
                    data-indicator
                    className={cn(
                        'flex size-6 shrink-0 items-center justify-center border-2 border-booking-control text-transparent',
                        type === 'radio' ? 'rounded-full' : 'rounded-md',
                    )}
                >
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                </span>
            </span>
        </label>
    );
}
