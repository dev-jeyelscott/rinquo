import { Link, usePage } from '@inertiajs/react';
import {
    CalendarCheckIcon,
    CheckCircle2Icon,
    CircleAlertIcon,
    EllipsisIcon,
    LayoutDashboardIcon,
    ListOrderedIcon,
    UserPlusIcon,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { EntitlementBanner } from '@/components/owner/entitlement-banner';
import { ScheduleImpactDialog } from '@/components/owner/schedule-impact-dialog';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ownerRoutes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';

/**
 * Shared tenant application shell for Owner pages (Decisions 46, 47, 206-210).
 * Desktop: the dark sidebar with the five primary destinations. Mobile: a
 * header with the business, branch and publication context plus the native-style
 * bottom navigation; Settings is reached through More. Settings pages own their
 * heading and Settings navigation (see SettingsPageHeader); non-Settings pages
 * keep the shell-owned page heading. The shell only presents; the server policy
 * decides who can read or change anything.
 */
export default function OwnerShell({ children }: { children: ReactNode }) {
    const { props, url } = usePage<OwnerPageProps>();
    const { appName, auth, flash, organization, entitlement } = props;
    const timezone = props.displayTimezone ?? 'Asia/Manila';
    const accessError = props.errors?.access;
    const onRequests = url.startsWith(organization.bookingRequestsUrl);
    const onOperations = url.startsWith(organization.operationsUrl);
    const onConflicts = url.startsWith(organization.conflictsUrl);
    const onBilling = url.startsWith(organization.billingUrl);
    const onSettings =
        !onRequests && !onOperations && !onConflicts && !onBilling;
    const context = (
        <>
            {organization.branchName ? (
                <StatusChip tone="info">{organization.branchName}</StatusChip>
            ) : null}
            <StatusChip tone={organization.publishedAt ? 'success' : 'neutral'}>
                {organization.publishedAt ? 'Published' : 'Draft'}
            </StatusChip>
        </>
    );

    return (
        <div className="min-h-screen bg-secondary/60 text-foreground lg:flex">
            <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
                <div className="grid gap-1 px-6 py-6">
                    <p className="text-3xl font-semibold tracking-tight">
                        {appName}
                    </p>
                    <p className="truncate font-semibold">
                        {organization.name}
                    </p>
                    {organization.branchName ? (
                        <p className="truncate text-sm text-sidebar-foreground/70">
                            {organization.branchName}
                        </p>
                    ) : null}
                    <StatusChip
                        tone={organization.publishedAt ? 'success' : 'neutral'}
                        className="mt-2 w-fit bg-background text-success transition-none"
                    >
                        {organization.publishedAt ? 'Published' : 'Draft'}
                    </StatusChip>
                </div>
                <nav
                    aria-label="Main"
                    className="mx-4 grid gap-2 border-t border-sidebar-border pt-4"
                >
                    <MainLink
                        href={organization.operationsUrl}
                        active={onOperations}
                    >
                        Operations
                    </MainLink>
                    <MainLink
                        href={organization.bookingRequestsUrl}
                        active={onRequests}
                    >
                        Booking Requests
                    </MainLink>
                    <MainLink
                        href={organization.conflictsUrl}
                        active={onConflicts}
                    >
                        Conflicts
                        <ConflictCount
                            count={organization.unresolvedConflicts}
                        />
                    </MainLink>
                    <MainLink href={organization.billingUrl} active={onBilling}>
                        Billing
                    </MainLink>
                    <MainLink href={organization.baseUrl} active={onSettings}>
                        Settings
                    </MainLink>
                </nav>
                <div className="mx-4 mt-auto border-t border-sidebar-border px-2 py-4 text-sm">
                    <p className="truncate text-sidebar-foreground/70">
                        {auth.user?.email}
                    </p>
                    <SignOut />
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-start justify-between gap-3 border-b bg-background px-4 py-4 lg:hidden">
                    <div className="grid min-w-0 gap-0.5">
                        <p className="text-2xl font-semibold tracking-tight text-primary">
                            {appName}
                        </p>
                        <p className="truncate font-semibold">
                            {organization.name}
                        </p>
                        {organization.branchName ? (
                            <p className="truncate text-sm text-muted-foreground">
                                {organization.branchName}
                            </p>
                        ) : null}
                    </div>
                    <div className="grid justify-items-end gap-1">
                        <StatusChip
                            tone={
                                organization.publishedAt ? 'success' : 'neutral'
                            }
                        >
                            {organization.publishedAt ? 'Published' : 'Draft'}
                        </StatusChip>
                        <SignOut />
                    </div>
                </header>
                {onSettings ? null : (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 sm:px-8">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {onOperations
                                ? 'Today’s operations'
                                : onConflicts
                                  ? 'Scheduling conflicts'
                                  : onRequests
                                    ? 'Booking requests'
                                    : 'Billing'}
                        </h1>
                        <div className="hidden flex-wrap items-center gap-2 lg:flex">
                            {context}
                        </div>
                    </div>
                )}
                <main className="flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pt-8 lg:pb-8">
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
                    {onSettings ? (
                        <div
                            aria-label="Branch and publication"
                            role="group"
                            className="mb-4 hidden justify-end gap-2 lg:-mb-7 lg:flex"
                        >
                            {context}
                        </div>
                    ) : null}
                    {children}
                    <MoreDestinations
                        conflictsUrl={organization.conflictsUrl}
                        unresolved={organization.unresolvedConflicts}
                        billingUrl={organization.billingUrl}
                        onConflicts={onConflicts}
                        onBilling={onBilling}
                    />
                    <ScheduleImpactDialog />
                </main>
            </div>
            <nav
                aria-label="Primary mobile"
                data-bottom-nav
                className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
            >
                <BottomLink
                    href={organization.operationsUrl}
                    label="Dashboard"
                    icon={LayoutDashboardIcon}
                    active={onOperations}
                />
                <BottomLink
                    href={`${organization.operationsUrl}#queue-heading`}
                    label="Queue"
                    icon={ListOrderedIcon}
                />
                <BottomLink
                    href={organization.bookingRequestsUrl}
                    label="Bookings"
                    icon={CalendarCheckIcon}
                    active={onRequests}
                />
                <BottomLink
                    href={`${organization.operationsUrl}#walk-in`}
                    label="Walk-in"
                    icon={UserPlusIcon}
                />
                <BottomLink
                    href={organization.baseUrl}
                    label="More"
                    icon={EllipsisIcon}
                    active={onSettings || onBilling || onConflicts}
                />
            </nav>
        </div>
    );
}

function ConflictCount({ count }: { count: number }) {
    if (count <= 0) {
        return null;
    }

    return (
        <span
            className="ml-2 rounded-full bg-warning px-2 text-xs font-semibold text-warning-foreground tabular-nums"
            aria-label={`${count} unresolved`}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}

/** Mobile-only secondary destinations that the bottom bar's More stands for. */
function MoreDestinations({
    conflictsUrl,
    unresolved,
    billingUrl,
    onConflicts,
    onBilling,
}: {
    conflictsUrl: string;
    unresolved: number;
    billingUrl: string;
    onConflicts: boolean;
    onBilling: boolean;
}) {
    const link =
        'flex min-h-11 items-center rounded-lg border bg-card px-4 text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none';

    return (
        <nav
            aria-label="More destinations"
            className="mt-8 grid gap-2 lg:hidden"
        >
            <Link
                href={conflictsUrl}
                className={link}
                aria-current={onConflicts ? 'page' : undefined}
            >
                Conflicts
                <ConflictCount count={unresolved} />
            </Link>
            <Link
                href={billingUrl}
                className={link}
                aria-current={onBilling ? 'page' : undefined}
            >
                Billing
            </Link>
        </nav>
    );
}

function BottomLink({
    href,
    label,
    icon: Icon,
    active = false,
}: {
    href: string;
    label: string;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    active?: boolean;
}) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex min-h-14 min-w-11 flex-col items-center justify-center gap-0.5 text-xs font-medium focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                active ? 'text-primary' : 'text-muted-foreground',
            )}
        >
            <Icon className="size-5" aria-hidden={true} />
            {label}
        </Link>
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
                'flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
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
        <Button
            asChild
            variant="link"
            size="sm"
            className="min-h-11 px-0 text-inherit"
        >
            <Link href={ownerRoutes.logout} method="post" as="button">
                Sign out
            </Link>
        </Button>
    );
}
