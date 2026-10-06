export type RenewalRequest = {
    id: string;
    amountCentavos: number;
    /** When the Rinquo request closes (24 hours after it was made). */
    expiresAt: string;
    /** Base64 image data for the current provider QR, or null when none is live. */
    qrImage: string | null;
    /** When the on-screen QR stops working; shorter than the request. */
    qrExpiresAt: string | null;
    providerError: boolean;
};

export type BillingPageData = {
    plan: {
        amountCentavos: number;
        currency: string;
        requestLifetimeHours: number;
    };
    billingAvailable: boolean;
    request: RenewalRequest | null;
    /** Set when the last request closed without payment (not a system failure). */
    lastRequestExpiredAt: string | null;
    lastPayment: {
        amountCentavos: number;
        paidAt: string;
        paidUntil: string;
    } | null;
    closureRecoveryDays: number;
};

export type BillingUrls = {
    renewal: string;
    billing: string;
    closure: string;
    recover: string;
};
