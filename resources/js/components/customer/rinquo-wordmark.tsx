import { Link } from '@inertiajs/react';

/** Neutral platform wordmark for customer account surfaces; never a shop brand. */
export function RinquoWordmark({
    appName,
    href,
}: {
    appName: string;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="flex min-h-11 items-center gap-2 rounded-md text-xl font-semibold tracking-tight focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
            <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground"
            >
                {appName.charAt(0)}
            </span>
            {appName}
        </Link>
    );
}
