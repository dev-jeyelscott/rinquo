import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CalendarDaysIcon,
    MapPinIcon,
    PlusIcon,
    SearchIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { AccountInfoPanel } from '@/components/customer/account-info-panel';
import { AccountPageHeader } from '@/components/customer/account-page-header';
import { AccountStateCard } from '@/components/customer/account-state-card';
import { ListPagination } from '@/components/operations/list-pagination';
import { StatusChip } from '@/components/owner/status-chip';
import { Button } from '@/components/ui/button';
import CustomerShell, { BOOK_URL } from '@/layouts/customer-shell';
import { formatInstant } from '@/lib/datetime';
import type {
    AccountBooking,
    AccountBookingStatus,
    BookingsProps,
} from '@/types/customer';

const STATUS: Record<
    AccountBookingStatus,
    { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }
> = {
    pending_approval: { label: 'Pending approval', tone: 'warning' },
    confirmed: { label: 'Confirmed', tone: 'success' },
    checked_in: { label: 'Checked in', tone: 'info' },
    in_service: { label: 'In service', tone: 'info' },
    completed: { label: 'Completed', tone: 'neutral' },
    no_show: { label: 'Missed', tone: 'neutral' },
    declined: { label: 'Declined', tone: 'neutral' },
    expired: { label: 'Expired', tone: 'neutral' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
    rescheduled: { label: 'Rescheduled', tone: 'neutral' },
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((word) => /^[\p{L}\p{N}]/u.test(word))
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();
}

function when(booking: AccountBooking): string {
    return formatInstant(booking.scheduledAt, booking.timezone, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * Cross-shop verified online bookings (Spec 06 refs 07-08). Only bookings the
 * signed-in customer made online with their verified email appear; each row
 * links to that shop's own booking page.
 */
export default function Bookings({ bookings, pageInfo }: BookingsProps) {
    const findShop = (
        <Button asChild className="h-11">
            <Link href={BOOK_URL} aria-label="Find a shop">
                <PlusIcon aria-hidden="true" />
                <span className="max-sm:sr-only">Find a shop</span>
            </Link>
        </Button>
    );

    return (
        <CustomerShell>
            <Head title="My bookings" />
            <div className="grid gap-6">
                <AccountPageHeader
                    title="My bookings"
                    description="Your verified online bookings across participating shops."
                    action={findShop}
                />
                {bookings.length === 0 ? (
                    <AccountStateCard
                        icon={CalendarDaysIcon}
                        title="No verified online bookings yet"
                        action={
                            <Button asChild className="h-11">
                                <Link href={BOOK_URL}>
                                    <SearchIcon aria-hidden="true" />
                                    Find a shop
                                </Link>
                            </Button>
                        }
                    >
                        Bookings placed using your verified Rinquo email will
                        appear here. Staff-entered unverified bookings are not
                        automatically linked to your account.
                    </AccountStateCard>
                ) : (
                    <>
                        <ul className="grid gap-3">
                            {bookings.map((booking) => (
                                <BookingRow
                                    key={booking.id}
                                    booking={booking}
                                />
                            ))}
                        </ul>
                        <ListPagination
                            noun="bookings"
                            info={pageInfo}
                            onPage={(page) =>
                                router.get(
                                    '/account/bookings',
                                    { page },
                                    { preserveScroll: false },
                                )
                            }
                        />
                        <AccountInfoPanel
                            icon={ShieldCheckIcon}
                            title="Private across businesses"
                        >
                            You can see your bookings across shops, but each
                            shop can only access its own activity.
                        </AccountInfoPanel>
                    </>
                )}
            </div>
        </CustomerShell>
    );
}

function BookingRow({ booking }: { booking: AccountBooking }) {
    const status = STATUS[booking.status] ?? {
        label: booking.status,
        tone: 'neutral' as const,
    };

    return (
        <li className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
            <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10 font-semibold text-primary sm:size-20 sm:text-lg"
            >
                {initials(booking.shop)}
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
                <h2 className="font-semibold break-words sm:text-lg">
                    {booking.shop}
                </h2>
                {booking.city ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon aria-hidden="true" className="size-4" />
                        <span className="sr-only">City: </span>
                        {booking.city}
                    </p>
                ) : null}
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                    <CalendarDaysIcon aria-hidden="true" className="size-4" />
                    <span className="sr-only">Scheduled: </span>
                    {when(booking)}
                </p>
            </div>
            <div className="grid shrink-0 justify-items-end gap-3">
                <StatusChip tone={status.tone}>{status.label}</StatusChip>
                <Button asChild variant="outline" className="max-sm:h-11">
                    <Link
                        href={booking.url}
                        aria-label={`View booking at ${booking.shop}`}
                    >
                        <ArrowRightIcon
                            aria-hidden="true"
                            className="max-sm:hidden"
                        />
                        View booking
                    </Link>
                </Button>
            </div>
        </li>
    );
}
