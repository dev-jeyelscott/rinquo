import { Link, usePage } from '@inertiajs/react';
import {
    CalendarDaysIcon,
    CarFrontIcon,
    CheckCircle2Icon,
    ClipboardListIcon,
    HouseIcon,
    ShieldCheckIcon,
    UserRoundIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { RinquoWordmark } from '@/components/customer/rinquo-wordmark';
import { StatusChip } from '@/components/owner/status-chip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AccountDestination =
    | 'home'
    | 'book'
    | 'bookings'
    | 'vehicles'
    | 'profile';

export const BOOK_URL = '/account/directory?view=book';

const DESTINATIONS: {
    key: AccountDestination;
    label: string;
    href: string;
    icon: LucideIcon;
}[] = [
    { key: 'home', label: 'Home', href: '/account/directory', icon: HouseIcon },
    { key: 'book', label: 'Book', href: BOOK_URL, icon: ClipboardListIcon },
    {
        key: 'bookings',
        label: 'Bookings',
        href: '/account/bookings',
        icon: CalendarDaysIcon,
    },
    {
        key: 'vehicles',
        label: 'Vehicles',
        href: '/account/vehicles',
        icon: CarFrontIcon,
    },
    {
        key: 'profile',
        label: 'Profile',
        href: '/account/profile',
        icon: UserRoundIcon,
    },
];

/**
 * The one current destination for an account URL. Home and Book are two intents
 * over the same directory route: a search (`q`) or the explicit `view=book`
 * means Book, the plain route is the Home landing. Both are URL-backed, so a
 * refresh or a shared link keeps the same current tab.
 */
export function accountDestination(url: string): AccountDestination | null {
    const [path, search = ''] = url.split('?');
    if (path.startsWith('/account/directory')) {
        const params = new URLSearchParams(search);

        return params.get('view') === 'book' || (params.get('q') ?? '') !== ''
            ? 'book'
            : 'home';
    }

    return (
        DESTINATIONS.find(
            (destination) =>
                destination.key !== 'home' &&
                destination.key !== 'book' &&
                path.startsWith(destination.href),
        )?.key ?? null
    );
}

function initials(name: string | null, email: string): string {
    const words = (name ?? '').split(/\s+/).filter(Boolean);
    if (words.length > 0) {
        return words
            .slice(0, 2)
            .map((word) => word.charAt(0))
            .join('')
            .toUpperCase();
    }

    return email.charAt(0).toUpperCase();
}

/**
 * Neutral Rinquo customer account shell (Spec 06, Decisions 44-45, 203).
 * Desktop: wordmark, five text destinations with one current, verified-account
 * context and the account menu. Mobile: wordmark and account menu above, five
 * icon-only bottom destinations with accessible names below. Individual shop
 * pages never use this shell; they keep TenantShopShell and the shop's brand.
 */
export default function CustomerShell({ children }: { children: ReactNode }) {
    const { url, props } = usePage();
    const current = accountDestination(url);
    const email = props.auth.user?.email ?? '';
    const customer = props.customer ?? null;
    const status = props.flash.status;

    return (
        <div className="flex min-h-screen flex-col bg-secondary/60 text-foreground">
            <a
                href="#main-content"
                onClick={(event) => {
                    event.preventDefault();
                    document.getElementById('main-content')?.focus();
                }}
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:ring-[3px] focus:ring-ring focus:outline-none"
            >
                Skip to main content
            </a>
            <header className="sticky top-0 z-30 border-b border-border bg-background">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem]">
                    <RinquoWordmark
                        appName={props.appName}
                        href="/account/directory"
                    />
                    <nav
                        aria-label="Customer account"
                        className="hidden self-stretch md:flex"
                    >
                        <ul className="flex gap-1">
                            {DESTINATIONS.map((destination) => (
                                <li key={destination.key} className="flex">
                                    <Link
                                        href={destination.href}
                                        aria-current={
                                            current === destination.key
                                                ? 'page'
                                                : undefined
                                        }
                                        className={cn(
                                            'flex items-center border-b-[3px] px-3 font-medium focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                                            current === destination.key
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {destination.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="flex items-center gap-3">
                        {customer?.emailVerified ? (
                            <StatusChip
                                tone="success"
                                className="hidden gap-1.5 lg:inline-flex"
                            >
                                <ShieldCheckIcon aria-hidden="true" />
                                Verified account
                            </StatusChip>
                        ) : null}
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                aria-label={`Account menu for ${email}`}
                                className="grid size-11 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <span aria-hidden="true">
                                    {initials(customer?.name ?? null, email)}
                                </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuLabel className="grid gap-0.5">
                                    {customer?.name ? (
                                        <span>{customer.name}</span>
                                    ) : null}
                                    <span className="truncate font-normal text-muted-foreground">
                                        {email}
                                    </span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/account/profile">Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/account/logout"
                                        method="post"
                                        as="button"
                                        className="w-full"
                                    >
                                        Sign out
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <main
                id="main-content"
                tabIndex={-1}
                className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6 md:pt-10 md:pb-12"
            >
                <div aria-live="polite" className="mb-5 empty:hidden">
                    {status ? (
                        <Alert
                            role="status"
                            className="border-success/40 bg-success/10"
                        >
                            <CheckCircle2Icon
                                aria-hidden="true"
                                className="text-success"
                            />
                            <AlertDescription className="text-foreground">
                                {status}
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </div>
                {children}
            </main>
            <nav
                aria-label="Customer account mobile"
                data-bottom-nav
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
            >
                <ul className="grid grid-cols-5">
                    {DESTINATIONS.map(({ key, label, href, icon: Icon }) => (
                        <li key={key} className="flex justify-center">
                            <Link
                                href={href}
                                aria-current={
                                    current === key ? 'page' : undefined
                                }
                                className="group grid min-h-16 w-full place-items-center focus-visible:outline-none"
                            >
                                <span
                                    className={cn(
                                        'grid size-11 place-items-center rounded-xl group-focus-visible:ring-[3px] group-focus-visible:ring-ring',
                                        current === key
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-6"
                                    />
                                </span>
                                <span className="sr-only">{label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}
