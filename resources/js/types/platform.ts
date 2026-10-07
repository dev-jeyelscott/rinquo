export type PlatformAdminSummary = { name: string; email: string };

export type SupportBannerData = {
    id: string;
    organizationName: string;
    targetEmail: string;
    targetRole: 'owner' | 'staff';
    reference: string;
    expiresAt: string;
    exitUrl: string;
};

export type PlatformShared = {
    admin: PlatformAdminSummary | null;
    support: SupportBannerData | null;
};

export type Pagination = {
    previousUrl: string | null;
    nextUrl: string | null;
};

export type AdminRow = {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'disabled';
    factorEnrolled: boolean;
    lastLoginAt: string | null;
};

export type InvitationRow = { id: number; email: string; expiresAt: string };

export type OrganizationRow = {
    id: number;
    name: string;
    slug: string;
    published: boolean;
    entitlement: 'trial' | 'paid' | 'grace' | 'restricted';
    closed: boolean;
    url: string;
};

export type MemberRow = {
    userId: number;
    email: string;
    role: 'owner' | 'staff';
};

export type PlanTermsValues = {
    amountCentavos: number;
    trialDays: number;
    graceDays: number;
};

export type PlanTermsVersion = PlanTermsValues & {
    id: number;
    effectiveAt: string;
    reason: string;
    inForce: boolean;
};

export type FailedJobRow = {
    uuid: string;
    queue: string;
    jobClass: string;
    exceptionClass: string;
    failedAt: string;
    retryable: boolean;
    retryNote: string;
};

export type RetryRow = {
    jobUuid: string;
    jobClass: string;
    status: 'claimed' | 'queued' | 'dispatch_failed';
    at: string;
};

export type ReadinessLine = { label: string; passed: boolean; detail: string };

export type SupportRequestRow = {
    id: string;
    serviceName: string;
    vehicleName: string;
    startAt: string;
    pendingExpiresAt: string | null;
};
