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
    /** Base path of the Owner settings tabs, e.g. /owner/organizations/1/settings. */
    baseUrl: string;
};

/** Props every Owner settings page receives from OwnerPage::render(). */
export type OwnerPageProps = {
    organization: OrganizationSummary;
    readiness: { isReady: boolean; items: ReadinessItem[] };
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
