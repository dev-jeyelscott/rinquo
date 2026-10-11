import type { CatalogVehicle } from '@/types/booking';

export type OperationalState =
    | 'scheduled'
    | 'checked_in'
    | 'in_service'
    | 'completed'
    | 'no_show';

export type BookingSource = 'online' | 'staff' | 'walk_in';

/** The focused mobile views of the one Operations domain; desktop shows them together. */
export type OperationsView =
    | 'dashboard'
    | 'queue'
    | 'bookings'
    | 'walk-in'
    | 'more';

export type QueueFilter = 'all' | 'checked_in' | 'in_service' | 'booked';

/** Server-authoritative page metadata of one bounded list. */
export type PageInfo = {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
    from: number;
    to: number;
};

export type QueueRowData = {
    id: string;
    customerName: string;
    customerPhone: string | null;
    vehicleName: string;
    vehiclePlate: string | null;
    serviceName: string;
    /** Snapshotted resource type the booking was made for. */
    resourceTypeName: string;
    addOns: string[];
    notes: string | null;
    /** UTC instant of the confirmed appointment; never changed by operations. */
    startAt: string;
    serviceEndAt: string;
    /** Projected finish while in service (actual start plus the booked duration). */
    etaAt: string | null;
    delayMinutes: number;
    state: OperationalState;
    source: BookingSource;
    resource: { id: number; name: string };
    units: number;
    compatibleResourceIds: number[];
    revision: number;
    /** Late-arrival grace snapshotted when the booking was confirmed. */
    graceMinutes: number;
    /** UTC instant from which no-show may be confirmed (appointment plus grace). */
    noShowEligibleAt: string;
    /** UTC instant of a late check-in; null for early and on-time arrivals. */
    lateArrivalAt: string | null;
    actions: {
        checkIn: boolean;
        start: boolean;
        complete: boolean;
        noShow: boolean;
        assign: boolean;
        reorder: boolean;
    };
};

export type CapacityRowData = {
    id: number;
    name: string;
    capacity: number;
    used: number;
    blocked: boolean;
};

export type BlockRowData = {
    id: string;
    resourceId: number;
    resourceName: string;
    startsAt: string;
    endsAt: string;
    reason: string;
};

export type AttentionItemData = {
    id: string;
    label: string;
    customerName: string;
    status: 'failed' | 'retrying';
    retryCount: number;
    failedAt: string;
};

export type ResourceOption = {
    id: number;
    name: string;
    typeId: number;
    capacity: number;
};

export type OperationsPageData = {
    day: {
        date: string;
        isToday: boolean;
        timezone: string;
        previous: string;
        next: string;
        today: string;
    };
    now: string;
    stats: {
        appointments: number;
        waiting: number;
        checkedIn: number;
        inService: number;
        completed: number;
        noShow: number;
        /** In-service work projected past its planned finish. */
        delayed: number;
    };
    view: OperationsView;
    filter: QueueFilter;
    pages: { queue: PageInfo; blocks: PageInfo; failures: PageInfo };
    queue: QueueRowData[];
    capacity: CapacityRowData[];
    blocks: BlockRowData[];
    attention: AttentionItemData[];
    resources: ResourceOption[];
    catalog: CatalogVehicle[];
    urls: {
        operations: string;
        bookings: string;
        blocks: string;
        failures: string;
        create: string;
    };
};
