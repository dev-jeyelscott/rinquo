import type { ShopImage } from '@/types/shop';
import type { PageInfo } from '@/types/operations';

/** Shell props shared on signed-in /account pages (HandleInertiaRequests::customer). */
export type CustomerShared = { name: string | null; emailVerified: boolean };

/** One directory card: only eligible shops, bounded and gated public data. */
export type DirectoryShop = {
    name: string;
    city: string | null;
    logo: ShopImage | null;
    cover: ShopImage | null;
    services: string[];
    moreServices: number;
    fromPriceCentavos: number | null;
    /** Runs of days with the same hours, e.g. "Mon–Sat · 8:00 AM–7:00 PM". */
    hours: string[];
    url: string;
    bookingUrl: string;
};

export type DirectoryProps = {
    query: string;
    shops: DirectoryShop[];
    /** More eligible shops exist beyond this bounded page. */
    hasMore: boolean;
};

export type AccountBookingStatus =
    | 'pending_approval'
    | 'confirmed'
    | 'declined'
    | 'expired'
    | 'cancelled'
    | 'rescheduled'
    | 'checked_in'
    | 'in_service'
    | 'completed'
    | 'no_show';

export type AccountBooking = {
    id: string;
    shop: string;
    city: string | null;
    status: AccountBookingStatus;
    scheduledAt: string;
    timezone: string;
    url: string;
};

export type BookingsProps = { bookings: AccountBooking[]; pageInfo: PageInfo };

export type SavedVehicle = {
    id: number;
    makeModel: string | null;
    plate: string | null;
    label: string | null;
};

export type CustomerProfileProps = {
    profile: {
        name: string;
        phone: string;
        email: string;
        emailVerified: boolean;
    };
    emailChange: {
        /** The new address a code was sent to; the current email is unchanged until it is verified. */
        pendingEmail: string | null;
        /** Set once, right after a verified change. */
        changedTo: string | null;
    };
};
