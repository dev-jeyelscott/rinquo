import { Link } from '@inertiajs/react';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Back = { label?: string } & (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
);

type Props = {
    back?: Back;
    /** Quiet context beside Back on small screens: "Step 2 of 5", "Time held: 08:43". */
    meta?: ReactNode;
    /** The one primary action. It fills the bar on small screens. */
    children: ReactNode;
    /** Accessible name of the action region. */
    label?: string;
    /**
     * One row on small screens (a bordered Back beside the primary action, as in the Spec 03
     * references) instead of the stacked Spec 02 bar. The desktop row is the same.
     */
    inline?: boolean;
};

/**
 * The booking journey's action row. Below `lg` it is a persistent bar fixed to
 * the bottom of the viewport (Back and a quiet status above one full-width
 * primary action) that respects the device safe-area inset; an `html` scroll
 * padding rule keeps focused fields from sliding underneath it. From `lg` up it
 * is an ordinary row at the end of the card with Back left and the primary
 * action right, so keyboard order always matches reading order.
 */
export function BookingActionBar({
    back,
    meta,
    children,
    label = 'Booking actions',
    inline = false,
}: Props) {
    const backClass = cn(
        buttonVariants({ variant: 'outline' }),
        inline
            ? 'border-booking-control max-lg:h-12 max-lg:shrink-0'
            : 'max-lg:min-h-11 max-lg:justify-start max-lg:border-0 max-lg:bg-transparent max-lg:px-0 max-lg:text-muted-foreground max-lg:shadow-none max-lg:hover:bg-transparent',
    );
    const backLabel = back?.label ?? 'Back';

    return (
        <div
            role="group"
            aria-label={label}
            data-booking-action-bar
            className={cn(
                'fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:mt-2 lg:flex lg:items-center lg:justify-between lg:border-t lg:px-0 lg:pt-5 lg:pb-0',
                inline
                    ? 'flex items-center gap-3 pt-3 lg:mt-0 lg:border-t-0 lg:pt-0'
                    : 'grid grid-cols-2 items-center gap-x-3',
            )}
        >
            {back ? (
                back.href !== undefined ? (
                    <Link href={back.href} className={backClass}>
                        <ArrowLeftIcon aria-hidden="true" />
                        {backLabel}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={back.onClick}
                        className={backClass}
                    >
                        <ArrowLeftIcon aria-hidden="true" />
                        {backLabel}
                    </button>
                )
            ) : (
                <span />
            )}
            {meta && !inline ? (
                <p className="justify-self-end text-sm text-muted-foreground tabular-nums lg:hidden">
                    {meta}
                </p>
            ) : inline ? null : (
                <span className="lg:hidden" />
            )}
            <div
                className={cn(
                    'lg:pt-0 max-lg:[&>*]:h-12 max-lg:[&>*]:w-full',
                    inline
                        ? 'min-w-0 flex-1 lg:flex-none'
                        : 'col-span-2 pt-1 lg:col-span-1',
                )}
            >
                {children}
            </div>
        </div>
    );
}
