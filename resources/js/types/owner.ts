export type ReadinessItem = {
    key: string;
    label: string;
    passed: boolean;
    detail: string;
    tab: 'profile' | 'hours' | 'services' | 'resources';
};

export type OrganizationSummary = {
    id: number;
    name: string;
    slug: string;
    /** Name of the organization's only branch (shown as the branch chip). */
    branchName?: string | null;
    /** UTC instant (ISO 8601) set by the explicit Publish action. */
    publishedAt: string | null;
    shopUrl: string;
    /** Staff operations dashboard for members of this organization. */
    operationsUrl: string;
    /** Scheduling-conflict dashboard for members of this organization. */
    conflictsUrl: string;
    /** Conflicts still needing Staff action or a customer answer. */
    unresolvedConflicts: number;
    /** Booking requests page for members of this organization. */
    bookingRequestsUrl: string;
    /** Base path of the Owner settings tabs, e.g. /owner/organizations/1/settings. */
    baseUrl: string;
    /** Billing page, reachable in every entitlement state. */
    billingUrl: string;
};

export type EntitlementState = 'trial' | 'paid' | 'grace' | 'restricted';

export type ClosureSummary = {
    /** recoverable until its deadline; deletion_eligible afterwards. */
    state: 'recoverable' | 'deletion_eligible';
    requestedAt: string;
    recoverableUntil: string;
    deletionEligibleAt: string | null;
};

/** Server-derived entitlement and closure, shared by every Owner and Staff page. */
export type Entitlement = {
    state: EntitlementState;
    trialEndsAt: string | null;
    paidUntil: string | null;
    graceEndsAt: string | null;
    closed: boolean;
    closure: ClosureSummary | null;
    acceptsNewBookings: boolean;
    allowsConfigurationWrites: boolean;
};

/** Props every Owner settings page receives from OwnerPage::render(). */
export type OwnerPageProps = {
    organization: OrganizationSummary;
    readiness: { isReady: boolean; items: ReadinessItem[] };
    entitlement: Entitlement;
};

export type AvailabilityReason =
    | 'service_inactive'
    | 'vehicle_type_inactive'
    | 'variant_inactive'
    | 'missing_consumption'
    | 'resource_type_inactive'
    | 'insufficient_capacity'
    | 'no_service_window'
    | 'no_business_hours';

export type Interval = { weekday: number; start: string; end: string };
