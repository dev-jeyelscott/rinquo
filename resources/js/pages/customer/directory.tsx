import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRightIcon,
    RefreshCwIcon,
    SearchIcon,
    ShieldCheckIcon,
    StoreIcon,
    WifiOffIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AccountPageHeader } from '@/components/customer/account-page-header';
import { AccountStateCard } from '@/components/customer/account-state-card';
import { ShopDirectoryCard } from '@/components/customer/shop-directory-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import CustomerShell, {
    accountDestination,
    BOOK_URL,
} from '@/layouts/customer-shell';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { DirectoryProps, DirectoryShop } from '@/types/customer';

const DIRECTORY_URL = '/account/directory';
const HOME_PREVIEW = 3;

type Failure = 'network' | 'server' | null;

/**
 * The neutral directory (Spec 06 refs 01, 04, 05). One route serves two
 * navigation intents: Home (the landing, no search) and Book (search and full
 * results, `?q=` or `?view=book`). The server decides eligibility and bounds
 * the page; this page only searches, shows the result honestly and hands off
 * to the shop's own tenant-branded routes.
 */
export default function Directory({ query, shops, hasMore }: DirectoryProps) {
    const { url } = usePage();
    const [value, setValue] = useState(query);
    const [searching, setSearching] = useState(false);
    const [failure, setFailure] = useState<Failure>(null);
    const [lastSearch, setLastSearch] = useState(query);
    const intent = accountDestination(url) === 'book' ? 'book' : 'home';

    function search(term: string) {
        if (searching) {
            return;
        }
        const trimmed = term.trim();
        setLastSearch(trimmed);
        setFailure(null);
        router.get(
            DIRECTORY_URL,
            trimmed === '' ? { view: 'book' } : { q: trimmed },
            {
                preserveState: true,
                preserveScroll: intent === 'book',
                onStart: () => setSearching(true),
                onNetworkError: () => {
                    setFailure('network');

                    return false;
                },
                onError: () => setFailure('server'),
                onFinish: () => setSearching(false),
            },
        );
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        search(value);
    }

    const form = (
        <SearchForm
            value={value}
            onChange={setValue}
            onSubmit={submit}
            searching={searching}
            variant={intent}
        />
    );
    const failureAlert =
        failure !== null ? (
            <Alert className={ALERT_TONES.error} role="alert">
                {failure === 'network' ? (
                    <WifiOffIcon aria-hidden="true" />
                ) : (
                    <RefreshCwIcon aria-hidden="true" />
                )}
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                    {failure === 'network'
                        ? 'We could not reach Rinquo. Check your connection and try again; the results below are from your last successful search.'
                        : 'The directory could not be loaded just now. Try again in a moment.'}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:h-11"
                        onClick={() => search(lastSearch)}
                    >
                        Try again
                    </Button>
                </AlertDescription>
            </Alert>
        ) : null;

    return (
        <CustomerShell>
            <Head title={intent === 'book' ? 'Find a shop' : 'Home'} />
            {intent === 'home' ? (
                <HomeLanding shops={shops} form={form} failure={failureAlert} />
            ) : (
                <section className="grid gap-6">
                    <AccountPageHeader
                        title="Find your next wash or detail"
                        description="Search participating businesses by shop name or city/municipality."
                    />
                    {form}
                    {failureAlert}
                    <Results
                        query={query}
                        shops={shops}
                        hasMore={hasMore}
                        onClear={() => {
                            setValue('');
                            search('');
                        }}
                    />
                </section>
            )}
        </CustomerShell>
    );
}

function SearchForm({
    value,
    onChange,
    onSubmit,
    searching,
    variant,
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    searching: boolean;
    variant: 'home' | 'book';
}) {
    const id = useId();

    return (
        <form
            role="search"
            onSubmit={onSubmit}
            className={cn(
                'flex w-full min-w-0 items-center gap-2 rounded-xl border border-booking-control bg-background p-2 text-foreground shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50 max-sm:gap-1 max-sm:p-1',
                variant === 'home' && 'max-w-xl',
            )}
        >
            <label htmlFor={id} className="sr-only">
                Search businesses by name or city
            </label>
            <SearchIcon
                aria-hidden="true"
                className="ml-2 size-5 shrink-0 text-muted-foreground max-sm:hidden"
            />
            <input
                id={id}
                type="search"
                value={value}
                maxLength={120}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Business name or city/municipality"
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground max-sm:placeholder:text-sm max-sm:[&::-webkit-search-cancel-button]:hidden"
            />
            <Button
                type="submit"
                className="h-11 px-4 max-sm:w-11 max-sm:shrink-0 max-sm:px-0"
                disabled={searching}
                aria-busy={searching}
            >
                {searching ? (
                    <Spinner role="presentation" aria-hidden="true" />
                ) : null}
                {/* Icon-only below sm so the placeholder stays readable; the text remains the accessible name. */}
                <SearchIcon aria-hidden="true" className="size-5 sm:hidden" />
                <span className="max-sm:sr-only">
                    {variant === 'home' ? 'Find a shop' : 'Search'}
                </span>
            </Button>
        </form>
    );
}

function Results({
    query,
    shops,
    hasMore,
    onClear,
}: {
    query: string;
    shops: DirectoryShop[];
    hasMore: boolean;
    onClear: () => void;
}) {
    if (shops.length === 0) {
        return query !== '' ? (
            <AccountStateCard
                icon={SearchIcon}
                title="No matching businesses"
                action={
                    <Button className="h-11" onClick={onClear}>
                        Clear search
                    </Button>
                }
            >
                We couldn’t find a listed business matching “{query}”. Try
                another shop name or city.
            </AccountStateCard>
        ) : (
            <AccountStateCard icon={StoreIcon} title="No businesses listed yet">
                Participating shops appear here once they join the Rinquo
                directory. A shop can still share its own booking link with you.
            </AccountStateCard>
        );
    }

    return (
        <section aria-labelledby="results-heading" className="grid gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="results-heading" className="text-xl font-semibold">
                    Participating businesses
                </h2>
                <p
                    className="text-sm text-muted-foreground tabular-nums"
                    aria-live="polite"
                >
                    {hasMore
                        ? `Showing the first ${shops.length} businesses. Search by name or city to narrow the list.`
                        : `${shops.length} ${shops.length === 1 ? 'business' : 'businesses'}${query ? ` matching “${query}”` : ''}`}
                </p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shops.map((shop) => (
                    <li key={shop.url}>
                        <ShopDirectoryCard shop={shop} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function HomeLanding({
    shops,
    form,
    failure,
}: {
    shops: DirectoryShop[];
    form: ReactNode;
    failure: ReactNode;
}) {
    const preview = shops.slice(0, HOME_PREVIEW);

    return (
        <div className="grid gap-8 md:gap-10">
            <section className="grid grid-cols-1 gap-8 overflow-hidden rounded-3xl bg-sidebar p-6 text-sidebar-foreground sm:p-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
                <div className="grid min-w-0 grid-cols-1 gap-4">
                    <p className="text-xs font-semibold tracking-widest text-sidebar-foreground/70 uppercase">
                        One account. Many shops.
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                        Your car care, all in one place.
                    </h1>
                    <p className="max-w-[56ch] text-sidebar-foreground/80 sm:text-lg">
                        Find participating wash and detailing shops, book with
                        confidence, and manage your verified bookings across
                        businesses.
                    </p>
                    <div className="mt-2">{form}</div>
                </div>
                <div className="hidden items-start gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-5 lg:flex">
                    <ShieldCheckIcon
                        aria-hidden="true"
                        className="mt-0.5 size-6 shrink-0"
                    />
                    <div className="grid gap-1">
                        <p className="font-semibold">Your Rinquo account</p>
                        <p className="text-sm text-sidebar-foreground/80">
                            Shared vehicles · Your bookings · One profile
                        </p>
                    </div>
                </div>
            </section>
            {failure}
            <section aria-labelledby="explore-heading" className="grid gap-4">
                <div className="flex items-end justify-between gap-4">
                    <div className="grid gap-1">
                        <h2
                            id="explore-heading"
                            className="text-2xl font-semibold tracking-tight"
                        >
                            Explore participating businesses
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Shops that opted into the Rinquo directory.
                        </p>
                    </div>
                    <Link
                        href={BOOK_URL}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                    >
                        View directory
                        <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </Link>
                </div>
                {preview.length > 0 ? (
                    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {preview.map((shop) => (
                            <li key={shop.url}>
                                <ShopDirectoryCard shop={shop} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
                        No businesses are listed in the directory yet.
                    </p>
                )}
            </section>
            <section
                aria-labelledby="how-heading"
                className="rounded-2xl border bg-card p-6"
            >
                <h2
                    id="how-heading"
                    className="text-xs font-semibold tracking-widest text-primary uppercase"
                >
                    How Rinquo works
                </h2>
                <ol className="mt-4 grid gap-4 md:grid-cols-3">
                    {[
                        ['Discover a shop', 'Search by business or city.'],
                        ['Choose and book', 'Continue in its branded shop.'],
                        [
                            'Manage in one place',
                            'See your verified online bookings.',
                        ],
                    ].map(([title, text], index) => (
                        <li key={title} className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                            >
                                {index + 1}
                            </span>
                            <span className="grid">
                                <span className="font-semibold">{title}</span>
                                <span className="text-sm text-muted-foreground">
                                    {text}
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
