export type ConflictCause =
    | 'resource_blocked'
    | 'resource_unavailable'
    | 'compatibility'
    | 'capacity'
    | 'hours';

export type ConflictStatus = 'open' | 'awaiting_customer' | 'resolved';

export type ConflictResolution =
    | 'same_time_reassigned'
    | 'customer_accepted'
    | 'booking_closed';

export type ProposalOutcome =
    | 'declined'
    | 'expired'
    | 'withdrawn'
    | 'replaced'
    | 'accepted';

export type ConflictRowData = {
    id: string;
    status: ConflictStatus;
    resolution: ConflictResolution | null;
    cause: ConflictCause;
    detectedAt: string;
    resolvedAt: string | null;
    revision: number;
    originalResource: string | null;
    reassignedResource: string | null;
    booking: {
        id: string;
        customerName: string;
        customerPhone: string | null;
        hasAccount: boolean;
        serviceName: string;
        vehicleName: string;
        status: string;
        startAt: string;
        serviceEndAt: string;
        durationMinutes: number;
        bufferMinutes: number;
    } | null;
    proposal: {
        id: string;
        startAt: string;
        expiresAt: string;
        resource: string | null;
        lapsed: boolean;
    } | null;
    lastOutcome: {
        status: ProposalOutcome;
        startAt: string;
        respondedAt: string | null;
    } | null;
    actions: { propose: boolean; withdraw: boolean };
};

export type CandidateTime = { startAt: string; resource: string };

export type ConflictsPageData = {
    now: string;
    timezone: string;
    counts: {
        needsProposal: number;
        awaitingCustomer: number;
        reassigned: number;
    };
    unresolved: ConflictRowData[];
    recent: ConflictRowData[];
    selectedId: string | null;
    candidates: { times: CandidateTime[]; error: string | null } | null;
    urls: { conflicts: string; operations: string };
};

/** What a scheduling change would do to future bookings; computed by the server, never by the client. */
export type ScheduleImpact = {
    affected: number;
    reassigned: number;
    conflicts: number;
    token: string;
    preview: boolean;
    stale: boolean;
    truncated: number;
    bookings: {
        id: string;
        customerName: string;
        serviceName: string;
        startAt: string;
        timezone: string;
        outcome: 'reassigned' | 'conflict';
        cause: ConflictCause;
        fromResource: string | null;
        toResource: string | null;
    }[];
};

export type ProposalForCustomer = {
    id: string;
    revision: number;
    startAt: string;
    expiresAt: string;
};
