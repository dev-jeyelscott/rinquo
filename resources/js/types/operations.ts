import type { CatalogVehicle } from '@/types/booking';

export type OperationalState =
    | 'scheduled'
    | 'checked_in'
    | 'in_service'
    | 'completed'
    | 'no_show';

export type BookingSource = 'online' | 'staff' | 'walk_in';

export type QueueRowData = {
    id: string;
    customerName: string;
    customerPhone: string | null;
    vehicleName: string;
    vehiclePlate: string | null;
    serviceName: string;
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
    };
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
