import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Quiet tinted note that explains an account boundary (for example that each
 * shop sees only its own activity). Informational only; never an action.
 */
export function AccountInfoPanel({
    icon: Icon,
    title,
    children,
    className,
}: {
    icon: LucideIcon;
    title: string;
    children: string;
    className?: string;
}) {
    return (
        <aside
            aria-label={title}
            className={cn(
                'flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6',
                className,
            )}
        >
            <Icon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <div className="grid gap-1">
                <h2 className="font-semibold">{title}</h2>
                <p className="max-w-[66ch] text-sm text-foreground/80">
                    {children}
                </p>
            </div>
        </aside>
    );
}
