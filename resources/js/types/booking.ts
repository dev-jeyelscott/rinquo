import type { ShopPageProps } from '@/types/shop';

/** Props the tenant-branded shell reads on every public shop page. */
export type ShopShellProps = Pick<
    ShopPageProps,
    'appName' | 'shop' | 'branch' | 'hours'
>;

export type CatalogAddOn = {
    id: number;
    name: string;
    priceCentavos: number;
    durationMinutes: number;
};

export type CatalogService = {
    id: number;
    name: string;
    description: string | null;
    priceCentavos: number;
    durationMinutes: number;
    bufferMinutes: number;
    addOns: CatalogAddOn[];
};

export type CatalogVehicle = {
    id: number;
    name: string;
    services: CatalogService[];
};

/** A local branch date (YYYY-MM-DD) and whether the shop is closed that day. */
export type BookingDate = { date: string; closed: boolean };

/** One candidate start time. Customers only ever learn "available or not". */
export type TimeSlot = { startAt: string; available: boolean };

export type DayAvailability = {
    date: string;
    closed: boolean;
    times: TimeSlot[];
};

export type NextAvailable = { startAt: string } | null;

export type BookingSelection = {
    vehicle: number | null;
    service: number | null;
    addOns: number[];
    date: string | null;
};

export type WizardPageProps = ShopShellProps & {
    catalog: CatalogVehicle[];
    dates: BookingDate[];
    policy: { minNoticeMinutes: number; horizonDays: number };
    selection: BookingSelection;
    availability?: DayAvailability | null;
    nextAvailable?: NextAvailable;
    urls: { holds: string; shop: string; wizard: string };
};

/** What the customer is booking, from current configuration. */
export type BookingSummary = {
    serviceName: string;
    vehicleName: string;
    addOns: { id: number; name: string; priceCentavos: number }[];
    priceCentavos: number;
    totalCentavos: number;
    durationMinutes: number;
    bufferMinutes: number;
    startAt: string;
    timezone: string;
};

export type HoldSummary = BookingSummary & {
    vehicleTypeId: number;
    serviceId: number;
    addOnIds: number[];
};

export type HoldPageProps = ShopShellProps & {
    hold: { publicId: string; expiresInSeconds: number; expired: boolean };
    summary: HoldSummary;
    signedIn: boolean;
    urls: {
        details: string;
        code: string;
        verify: string;
        restart: string;
        confirm: string;
        wizard: string;
        shop: string;
    };
};

export type ContactDetails = {
    name: string;
    phone: string;
    plate: string;
    notes: string;
};

export type VerificationState = {
    step: 'details' | 'code';
    email: string | null;
    resendInSeconds: number;
    codeLength: number;
    cooldownSeconds: number;
};

export type DetailsPageProps = HoldPageProps & {
    contact: ContactDetails;
    verification: VerificationState;
};

export type ConfirmPageProps = HoldPageProps & {
    contact: {
        name: string;
        phone: string | null;
        plate: string | null;
        notes: string | null;
    };
    customerEmail: string;
};

export type BookingStatus =
    | 'pending_approval'
    | 'confirmed'
    | 'declined'
    | 'expired'
    | 'cancelled'
    | 'rescheduled';

export type BookingPageProps = ShopShellProps & {
    booking: Omit<BookingSummary, 'priceCentavos' | 'addOns'> & {
        publicId: string;
        status: BookingStatus;
        addOns: { name: string; priceCentavos: number }[];
        pendingExpiresAt: string | null;
        contactName: string;
        contactEmail: string;
        revision: number;
        actions: {
            canCancel: boolean;
            canReschedule: boolean;
            reason: string | null;
            /** Why rescheduling alone is blocked (for example a restricted shop). */
            rescheduleReason: string | null;
            /** When the customer can no longer change the booking, if still open. */
            deadlineAt: string | null;
        };
    };
    urls: { shop: string; cancel: string; reschedule: string };
};

export type BookingRequest = {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    vehicleName: string;
    vehiclePlate: string | null;
    serviceName: string;
    addOns: string[];
    notes: string | null;
    startAt: string;
    pendingExpiresAt: string;
    timezone: string;
    revision: number;
    cancelUrl: string;
};
