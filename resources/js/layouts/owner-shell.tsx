import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2Icon, CircleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EntitlementBanner } from '@/components/owner/entitlement-banner';
import { ScheduleImpactDialog } from '@/components/owner/schedule-impact-dialog';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ownerRoutes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';

const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'hours', label: 'Business hours' },
    { key: 'services', label: 'Services' },
    { key: 'resources', label: 'Resources' },
    { key: 'booking-policy', label: 'Booking policy' },
    { key: 'readiness', label: 'Readiness' },
    { key: 'directory', label: 'Directory' },
] as const;

/**
 * Owner settings shell (reference screen 05). A dark navy sidebar holds the
 * wordmark, the organization and the destinations that exist today (Settings
 * and Booking requests); on small screens it becomes a compact top bar with the
 * destinations beneath it. The page header carries the title and branch chip,
 * and the configuration tabs sit in the content area as pills next to the OWNER
 * ONLY marker. The Booking requests page, which any member may open, hides the
 * Owner-only tabs. The shell only presents; the server policy decides who can
 * read or change anything.
 */
export default function OwnerShell({ children }: { children: ReactNode }) {
    const { props, url } = usePage<OwnerPageProps>();
    const { appName, auth, flash, organization, readiness, entitlement } =
        props;
    const timezone = props.displayTimezone ?? 'Asia/Manila';
    const accessError = props.errors?.access;
    const onRequests = url.startsWith(organization.bookingRequestsUrl);
    const onOperations = url.startsWith(organization.operationsUrl);
    const onConflicts = url.startsWith(organization.conflictsUrl);
    const onBilling = url.startsWith(organization.billingUrl);
    const onSettings =
        !onRequests && !onOperations && !onConflicts && !onBilling;
    const failing = new Set<string>(
        readiness.items.filter((item) => !item.passed).map((i) => i.tab),
    );

    return (
        <div className="min-h-screen bg-secondary/60 text-foreground lg:flex">
            <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-6 lg:py-6">
                    <div className="min-w-0">
                        <p className="text-xl font-semibold tracking-tight">
                            {appName}
                        </p>
                        <p className="truncate text-sm text-sidebar-foreground/70">
                            {organization.name}
                        </p>
                    </div>
                    <div className="lg:hidden">
                        <SignOut />
                    </div>
                </div>
                <nav
                    aria-label="Main"
                    className="flex gap-2 px-3 pb-3 lg:grid lg:pb-0"
                >
                    <MainLink
                        href={organization.operationsUrl}
                        active={onOperations}
                    >
                        Operations
                    </MainLink>
                    <MainLink
                        href={organization.conflictsUrl}
                        active={onConflicts}
                    >
                        Conflicts
                        {organization.unresolvedConflicts > 0 ? (
                            <span
                                className="ml-2 rounded-full bg-warning px-2 text-xs font-semibold text-warning-foreground tabular-nums"
                                aria-label={`${organization.unresolvedConflicts} unresolved`}
                            >
                                {organization.unresolvedConflicts}
                            </span>
                        ) : null}
                    </MainLink>
                    <MainLink
                        href={organization.bookingRequestsUrl}
                        active={onRequests}
                    >
                        Booking requests
                    </MainLink>
                    <MainLink href={organization.billingUrl} active={onBilling}>
                        Billing
                    </MainLink>
                    <MainLink
                        href={`${organization.baseUrl}/profile`}
                        active={onSettings}
                    >
                        Settings
                    </MainLink>
                </nav>
                <div className="mt-auto hidden px-6 py-4 text-sm lg:block">
                    <p className="truncate text-sidebar-foreground/70">
                        {auth.user?.email}
                    </p>
                    <SignOut />
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 sm:px-8">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {onOperations
                            ? 'Today’s operations'
                            : onConflicts
                              ? 'Scheduling conflicts'
                              : onRequests
                                ? 'Booking requests'
                                : onBilling
                                  ? 'Billing'
                                  : 'Scheduling configuration'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2">
                        {organization.branchName ? (
                            <StatusChip tone="info">
                                {organization.branchName}
                            </StatusChip>
                        ) : null}
                        <StatusChip
                            tone={
                                organization.publishedAt ? 'success' : 'neutral'
                            }
                        >
                            {organization.publishedAt ? 'Published' : 'Draft'}
                        </StatusChip>
                    </div>
                </header>
                <main className="flex-1 px-4 py-6 sm:px-8">
                    {!onSettings ? null : (
                        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                            <nav
                                aria-label="Settings"
                                className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-1"
                            >
                                {TABS.map((tab) => {
                                    const href = `${organization.baseUrl}/${tab.key}`;
                                    const active = url.startsWith(href);

                                    return (
                                        <Link
                                            key={tab.key}
                                            href={href}
                                            aria-current={
                                                active ? 'page' : undefined
                                            }
                                            className={cn(
                                                'flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                                                active
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'bg-card text-card-foreground hover:bg-accent',
                                            )}
                                        >
                                            {tab.label}
                                            {failing.has(tab.key) ? (
                                                <CircleAlertIcon
                                                    className="size-4"
                                                    aria-label="Needs attention"
                                                />
                                            ) : null}
                                        </Link>
                                    );
                                })}
                            </nav>
                            <StatusChip tone="info" caps>
                                Owner only
                            </StatusChip>
                        </div>
                    )}
                    <EntitlementBanner
                        entitlement={entitlement}
                        billingUrl={organization.billingUrl}
                        onBilling={onBilling}
                        timezone={timezone}
                    />
                    <div aria-live="polite" className="mb-4 empty:hidden">
                        {accessError ? (
                            <Alert
                                role="alert"
                                className="border-destructive/40 bg-destructive/10"
                            >
                                <CircleAlertIcon
                                    aria-hidden="true"
                                    className="text-destructive"
                                />
                                <AlertDescription className="text-foreground">
                                    {accessError}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        {flash.status ? (
                            <Alert
                                role="status"
                                className="border-success/40 bg-success/10"
                            >
                                <CheckCircle2Icon
                                    aria-hidden="true"
                                    className="text-success"
                                />
                                <AlertDescription className="text-foreground">
                                    {flash.status}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>
                    {children}
                    <ScheduleImpactDialog />
                </main>
            </div>
        </div>
    );
}

function MainLink({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50',
            )}
        >
            {children}
        </Link>
    );
}

function SignOut() {
    return (
        <Button asChild variant="link" size="sm" className="text-inherit">
            <Link href={ownerRoutes.logout} method="post" as="button">
                Sign out
            </Link>
        </Button>
    );
}
