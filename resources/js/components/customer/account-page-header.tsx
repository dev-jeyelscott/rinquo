import type { ReactNode, Ref } from 'react';

/** Page heading for a customer account page: title, one-line purpose and an optional primary action. */
export function AccountPageHeader({
    title,
    description,
    action,
    headingRef,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    /** Lets the page move focus here when a change removes the control that had it. */
    headingRef?: Ref<HTMLHeadingElement>;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="grid min-w-0 gap-1.5">
                <h1
                    ref={headingRef}
                    tabIndex={headingRef ? -1 : undefined}
                    className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
                >
                    {title}
                </h1>
                <p className="max-w-[66ch] text-muted-foreground sm:text-lg">
                    {description}
                </p>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
