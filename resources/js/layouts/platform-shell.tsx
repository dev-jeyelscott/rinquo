import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2Icon, ShieldAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SupportBanner } from '@/components/platform/support-banner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';

const LINKS = [
    { href: '/platform', label: 'Overview', exact: true },
    { href: '/platform/organizations', label: 'Organizations' },
    { href: '/platform/failed-jobs', label: 'Failed jobs' },
    { href: '/platform/plan-terms', label: 'Plan terms' },
    { href: '/platform/admins', label: 'Administrators' },
    { href: '/platform/security', label: 'Security' },
] as const;

/**
 * Neutral platform administration shell. It uses existing semantic tokens and primitives and
 * is deliberately not a canonical navigation pattern: no Platform Admin Reference UI is
 * approved. A signed-out visitor (sign-in, factor, reset) gets the same header without the
 * navigation. During a support session the persistent banner is rendered above everything.
 */
export default function PlatformShell({ children }: { children: ReactNode }) {
    const { props, url } = usePage();
    const { appName, flash } = props;
    const admin = props.platform?.admin ?? null;
    const support = props.platform?.support ?? null;
    const path = url.split('?')[0];

    return (
        <div className="flex min-h-screen flex-col bg-secondary/60 text-foreground">
            {support ? <SupportBanner support={support} /> : null}
            <header className="border-b border-border bg-background">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <p className="text-base font-semibold">
                        {appName}{' '}
                        <span className="font-normal text-muted-foreground">
                            Platform
                        </span>
                    </p>
                    {admin ? (
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">
                                {admin.email}
                            </span>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="max-sm:h-11"
                            >
                                <Link
                                    href="/platform/logout"
                                    method="post"
                                    as="button"
                                >
                                    Sign out
                                </Link>
                            </Button>
                        </div>
                    ) : null}
                </div>
                {admin && !support ? (
                    <nav
                        aria-label="Platform"
                        className="mx-auto flex w-full max-w-6xl flex-wrap gap-1 px-4 pb-2 sm:px-6"
                    >
                        {LINKS.map((link) => {
                            const active =
                                'exact' in link && link.exact
                                    ? path === link.href
                                    : path.startsWith(link.href);

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9',
                                        active
                                            ? 'bg-secondary text-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>
                ) : null}
            </header>
            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
                {flash?.status ? (
                    <Alert role="status" className={ALERT_TONES.success}>
                        <CheckCircle2Icon aria-hidden="true" />
                        <AlertDescription>{flash.status}</AlertDescription>
                    </Alert>
                ) : null}
                {props.errors?.access ? (
                    <Alert variant="destructive">
                        <ShieldAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            {props.errors.access}
                        </AlertDescription>
                    </Alert>
                ) : null}
                {children}
            </main>
        </div>
    );
}
