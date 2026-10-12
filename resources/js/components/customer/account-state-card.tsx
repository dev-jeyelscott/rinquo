import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Centered, durable state for a whole account section: a valid empty result,
 * or a confirmed outcome. The icon tile reinforces the tone; the heading and
 * text always carry the meaning, and one action continues the workflow.
 */
export function AccountStateCard({
    icon: Icon,
    title,
    children,
    action,
    tone = 'info',
    headingLevel = 2,
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
    action?: ReactNode;
    tone?: 'info' | 'success';
    headingLevel?: 1 | 2;
}) {
    const Heading = headingLevel === 1 ? 'h1' : 'h2';

    return (
        <section className="mx-auto grid w-full max-w-3xl justify-items-center gap-4 rounded-2xl border bg-card px-6 py-12 text-center shadow-xs sm:px-12">
            <span
                aria-hidden="true"
                className={cn(
                    'grid size-16 place-items-center rounded-2xl',
                    tone === 'success'
                        ? 'bg-success/10 text-success'
                        : 'bg-primary/10 text-primary',
                )}
            >
                <Icon className="size-7" />
            </span>
            <Heading className="text-2xl font-semibold tracking-tight">
                {title}
            </Heading>
            <div className="max-w-[60ch] text-muted-foreground">{children}</div>
            {action ? <div className="mt-2">{action}</div> : null}
        </section>
    );
}
