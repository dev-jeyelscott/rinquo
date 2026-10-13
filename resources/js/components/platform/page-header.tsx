import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';

/**
 * Signed-in Platform page heading (Spec 08): a quiet eyebrow naming the area, the single
 * h1, a one-line purpose and an optional page action. It also sets the document title.
 */
export function PageHeader({
    eyebrow,
    title,
    description,
    action,
    documentTitle,
}: {
    eyebrow: string;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    documentTitle?: string;
}) {
    return (
        <>
            <Head title={documentTitle ?? title} />
            <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                <div className="grid min-w-0 gap-1">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                        {eyebrow}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
                        {title}
                    </h1>
                    {description ? (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </header>
        </>
    );
}
