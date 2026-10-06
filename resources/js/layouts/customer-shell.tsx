import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';

const links = [
    ['Directory', '/account/directory'],
    ['My bookings', '/account/bookings'],
    ['Vehicles', '/account/vehicles'],
    ['Profile', '/account/profile'],
] as const;

/** Neutral platform context; individual shop pages intentionally use TenantShopShell. */
export default function CustomerShell({ children }: { children: ReactNode }) {
    const { url, props } = usePage();
    return (
        <div className="flex min-h-screen flex-col bg-secondary/60 text-foreground">
            <header className="border-b border-border bg-background">
                <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
                    <Link
                        href="/account/directory"
                        className="font-semibold tracking-tight"
                    >
                        {props.appName}
                    </Link>
                    <nav
                        aria-label="Customer account"
                        className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                    >
                        {links.map(([label, href]) => (
                            <Link
                                key={href}
                                href={href}
                                className={
                                    url.startsWith(href)
                                        ? 'font-semibold text-foreground'
                                        : 'text-muted-foreground'
                                }
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
                {children}
            </main>
        </div>
    );
}
