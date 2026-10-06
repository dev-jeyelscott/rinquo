import type { Entitlement } from '@/types/owner';

/** A paid, unrestricted organization: what most page tests render with. */
export const ACTIVE_ENTITLEMENT: Entitlement = {
    state: 'paid',
    trialEndsAt: '2026-10-19T00:00:00+00:00',
    paidUntil: '2026-11-19T00:00:00+00:00',
    graceEndsAt: '2026-11-26T00:00:00+00:00',
    closed: false,
    closure: null,
    acceptsNewBookings: true,
    allowsConfigurationWrites: true,
};

export const BILLING_URL = '/owner/organizations/1/settings/billing';
