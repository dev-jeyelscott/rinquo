import { accessEndsAt, formatDateTime } from '@/lib/billing';
import { formatCentavos } from '@/lib/money';
import type { BillingPageData } from '@/types/billing';
import type { Entitlement } from '@/types/owner';

/**
 * Every Billing state the approved Spec 07 references show. A scene is derived
 * only from server props (entitlement, request, last payment) and the clock; it
 * never invents a payment status. Grace, restricted and closed describe the
 * actual access condition, so they outrank any renewal-request scene.
 */
export type BillingScene =
    | 'trial'
    | 'paid'
    | 'renewal'
    | 'grace'
    | 'restricted'
    | 'closed'
    | 'recovery_ended'
    | 'prepared'
    | 'qr_ready'
    | 'qr_expired'
    | 'request_expired'
    | 'provider_error'
    | 'confirmed';

export type Tone = 'info' | 'success' | 'warning' | 'neutral';

export type BillingAction =
    /** Moves to the renewal section, which holds the real request controls. */
    | { kind: 'renewal'; label: string }
    | { kind: 'operations'; label: string }
    | null;

export type BillingView = {
    scene: BillingScene;
    eyebrow: string;
    /** The hero value: the plan price, a day count or a short state word. */
    hero: { text: string; suffix: string | null };
    pill: { label: string; tone: Tone };
    nextDate: { label: string; value: string | null };
    action: BillingAction;
    remains: string[];
    safeNext: string;
    policy: string;
    /** In-page banner for non-access scenes; grace, restricted and closed use EntitlementBanner. */
    banner: {
        tone: 'info' | 'success' | 'warning' | 'error';
        title: string;
        body: string;
    } | null;
};

type Input = {
    entitlement: Entitlement;
    billing: BillingPageData;
    now: number;
    online: boolean;
    timezone: string;
};

const DAY_MS = 86_400_000;
const RENEWAL_WINDOW_DAYS = 7;
const CONFIRMED_VISIBLE_MS = DAY_MS;

export function billingScene({
    entitlement,
    billing,
    now,
    online,
}: Omit<Input, 'timezone'>): BillingScene {
    if (entitlement.closed && entitlement.closure) {
        return entitlement.closure.state === 'recoverable'
            ? 'closed'
            : 'recovery_ended';
    }
    if (entitlement.state === 'grace' || entitlement.state === 'restricted') {
        return entitlement.state;
    }

    const request = billing.request;
    const requestOpen = request !== null && Date.parse(request.expiresAt) > now;
    const paidAt = billing.lastPayment
        ? Date.parse(billing.lastPayment.paidAt)
        : null;

    if (
        !requestOpen &&
        paidAt !== null &&
        Math.abs(now - paidAt) <= CONFIRMED_VISIBLE_MS
    ) {
        return 'confirmed';
    }
    if (requestOpen && request) {
        if (request.providerError || !online) {
            return 'provider_error';
        }
        if (
            request.qrImage !== null &&
            Date.parse(request.qrExpiresAt ?? '') > now
        ) {
            return 'qr_ready';
        }

        return request.qrExpiresAt === null ? 'prepared' : 'qr_expired';
    }
    if (!online || !billing.billingAvailable) {
        return 'provider_error';
    }
    if (billing.lastRequestExpiredAt) {
        return 'request_expired';
    }

    const ends = accessEndsAt(entitlement.trialEndsAt, entitlement.paidUntil);
    if (
        entitlement.state === 'paid' &&
        ends !== null &&
        Date.parse(ends) - now <= RENEWAL_WINDOW_DAYS * DAY_MS
    ) {
        return 'renewal';
    }

    return entitlement.state;
}

const PAYMENT_REMAINS = (hours: number) => [
    'Only verified PayMongo confirmation activates access',
    `Renewal request lasts ${hours} hours`,
    'A QR code may expire sooner',
    'Never pay twice during uncertain provider status',
];
const ACCESS_REMAINS = [
    'Shop status and renewal deadline are server-owned',
    'Early renewal extends the paid-through date',
    'Existing bookings remain protected',
    'Renewal does not close the organization',
];
const RESTRICTED_REMAINS = [
    'Existing bookings can be operated and completed',
    'Customer cancellation remains allowed',
    'No new bookings or customer reschedules',
    'Billing and recovery remain available to the Owner',
];
const closureRemains = (days: number) => [
    'Closure starts only by explicit Owner request',
    `${days}-day recovery window is independent of non-renewal`,
    'Existing bookings are preserved',
    'Non-renewal never triggers data deletion',
];

export function describeBilling(input: Input): BillingView {
    const { entitlement, billing, now, timezone } = input;
    const scene = billingScene(input);
    const price = {
        text: formatCentavos(billing.plan.amountCentavos),
        suffix: '/ month',
    };
    const hours = billing.plan.requestLifetimeHours;
    const at = (iso: string | null) =>
        iso ? formatDateTime(iso, timezone) : '';
    const unpaidTrial = entitlement.paidUntil === null;
    const entitlementDate = {
        trial: { label: 'Trial ends', value: entitlement.trialEndsAt },
        paid: { label: 'Paid through', value: entitlement.paidUntil },
        renewal: { label: 'Paid through', value: entitlement.paidUntil },
        grace: { label: 'Grace ends', value: entitlement.graceEndsAt },
        restricted: unpaidTrial
            ? { label: 'Trial ended', value: entitlement.trialEndsAt }
            : { label: 'Restriction began', value: entitlement.graceEndsAt },
    };
    const date = (
        key: keyof typeof entitlementDate | 'confirmed',
    ): BillingView['nextDate'] =>
        key === 'confirmed'
            ? {
                  label: 'Paid through',
                  value: billing.lastPayment?.paidUntil ?? null,
              }
            : entitlementDate[key];
    const baseEntitlement: keyof typeof entitlementDate =
        entitlement.state === 'trial'
            ? 'trial'
            : entitlement.state === 'paid'
              ? 'paid'
              : entitlement.state;

    const base = {
        eyebrow: '',
        hero: price,
        nextDate: date(baseEntitlement),
        action: { kind: 'renewal', label: 'Renew with QR Ph' } as BillingAction,
        remains: ACCESS_REMAINS,
    };

    switch (scene) {
        case 'trial':
            return {
                ...base,
                scene,
                eyebrow: 'Free trial',
                pill: { label: 'Trial', tone: 'info' },
                action: { kind: 'renewal', label: 'Start payment' },
                safeNext:
                    'Your paid month begins after the trial. Existing bookings remain protected.',
                policy: 'A payment made during the trial buys one month that starts when the trial ends.',
                banner: {
                    tone: 'info',
                    title: 'Free trial active',
                    body: `Your trial runs until ${at(entitlement.trialEndsAt)}. Pay before then to avoid a pause in new bookings.`,
                },
            };
        case 'paid':
            return {
                ...base,
                scene,
                eyebrow: 'Paid subscription',
                pill: { label: 'Paid', tone: 'success' },
                action: { kind: 'renewal', label: 'View renewal options' },
                safeNext:
                    'Paying early adds one month after the current paid-through date.',
                policy: 'Each payment buys one calendar month and is confirmed only by PayMongo.',
                banner: {
                    tone: 'success',
                    title: 'Subscription active',
                    body: 'Your shop can accept new bookings and manage configuration.',
                },
            };
        case 'renewal': {
            const days = Math.max(
                1,
                Math.ceil(
                    (Date.parse(entitlement.paidUntil ?? '') - now) / DAY_MS,
                ),
            );

            return {
                ...base,
                scene,
                eyebrow: `Renewal due in ${days} ${days === 1 ? 'day' : 'days'}`,
                pill: { label: 'Renewal', tone: 'warning' },
                nextDate: date('renewal'),
                safeNext:
                    'Reminder emails are sent 7, 3 and 1 day before expiry.',
                policy: 'Paying early adds one month after the current paid-through date.',
                banner: {
                    tone: 'warning',
                    title: 'Renewal coming up',
                    body: 'Your current plan is paid and stays active until the stated deadline.',
                },
            };
        }
        case 'grace': {
            const days = Math.max(
                1,
                Math.ceil(
                    (Date.parse(entitlement.graceEndsAt ?? '') - now) / DAY_MS,
                ),
            );

            return {
                ...base,
                scene,
                eyebrow: 'Paid period expired',
                hero: {
                    text: `${days} ${days === 1 ? 'day' : 'days'}`,
                    suffix: 'left',
                },
                pill: { label: 'Grace', tone: 'warning' },
                action: { kind: 'renewal', label: 'Renew now' },
                safeNext:
                    'Renew before grace ends to keep taking new bookings without interruption.',
                policy: 'Grace applies after a paid period ends. An unpaid trial has none.',
                banner: null,
            };
        }
        case 'restricted':
            return {
                ...base,
                scene,
                eyebrow: 'Access state',
                hero: { text: 'Restricted', suffix: null },
                pill: { label: 'Restricted', tone: 'warning' },
                action: { kind: 'renewal', label: 'Renew using QR Ph' },
                remains: RESTRICTED_REMAINS,
                safeNext:
                    'Non-renewal never closes or deletes the organization. Existing work remains operable.',
                policy: 'A month paid now starts when the payment is confirmed. Recovering a closed organization never renews an expired subscription.',
                banner: null,
            };
        case 'closed':
            return {
                ...base,
                scene,
                eyebrow: 'Closure history',
                hero: { text: 'Closed', suffix: null },
                pill: { label: 'Closed', tone: 'warning' },
                nextDate: {
                    label: 'Recoverable until',
                    value: entitlement.closure?.recoverableUntil ?? null,
                },
                action: null,
                remains: closureRemains(billing.closureRecoveryDays),
                safeNext:
                    'Recovery restores only the subscription access currently valid.',
                policy: 'Recovery never renews an expired subscription or grants a free paid period.',
                banner: null,
            };
        case 'recovery_ended':
            return {
                ...base,
                scene,
                eyebrow: 'Closure history',
                hero: { text: 'Closed', suffix: null },
                pill: { label: 'Recovery ended', tone: 'warning' },
                nextDate: {
                    label: 'Self-service recovery ended',
                    value: entitlement.closure?.recoverableUntil ?? null,
                },
                action: null,
                remains: closureRemains(billing.closureRecoveryDays),
                safeNext:
                    'Nothing is deleted automatically by non-renewal or by this window passing.',
                policy: 'Rinquo Platform Operations manages the next retention step.',
                banner: null,
            };
        case 'prepared':
            return {
                ...base,
                scene,
                eyebrow: 'Renewal request ready',
                pill: { label: 'Request open', tone: 'info' },
                action: null,
                remains: PAYMENT_REMAINS(hours),
                safeNext: 'Generate a QR code to pay. Do not pay twice.',
                policy: 'Access changes only after PayMongo confirms the payment.',
                banner: {
                    tone: 'info',
                    title: 'Renewal request ready',
                    body: 'Generate a QR code to pay. Access changes only after PayMongo confirms the payment.',
                },
            };
        case 'qr_ready':
            return {
                ...base,
                scene,
                eyebrow: 'Waiting for verified payment',
                pill: { label: 'QR ready', tone: 'info' },
                action: null,
                remains: PAYMENT_REMAINS(hours),
                safeNext:
                    'Do not pay twice. Rinquo activates access only after verified provider confirmation.',
                policy: 'This page updates by itself once PayMongo confirms the payment.',
                banner: {
                    tone: 'info',
                    title: 'QR Ph payment is ready',
                    body: 'Scan using a supported QR Ph banking or e-wallet app.',
                },
            };
        case 'qr_expired':
            return {
                ...base,
                scene,
                eyebrow: 'QR expired, request open',
                pill: { label: 'QR expired', tone: 'warning' },
                action: null,
                remains: PAYMENT_REMAINS(hours),
                safeNext:
                    'Refresh the QR to pay. Your renewal request is still open.',
                policy: 'A QR code lasts only a short time and can expire before the request does.',
                banner: {
                    tone: 'warning',
                    title: 'The QR code expired',
                    body: 'Your renewal request is still open. Refresh the QR code to pay.',
                },
            };
        case 'request_expired':
            return {
                ...base,
                scene,
                eyebrow: 'New request required',
                pill: { label: 'Request expired', tone: 'warning' },
                nextDate: {
                    label: 'Previous request ended',
                    value: billing.lastRequestExpiredAt,
                },
                action: null,
                remains: PAYMENT_REMAINS(hours),
                safeNext:
                    'While your renewal window is open Rinquo also prepares a new request automatically. You can generate one now.',
                policy: 'An expired request means no payment was confirmed. Nothing was charged.',
                banner: {
                    tone: 'warning',
                    title: 'The payment request ended',
                    body: `The ${hours}-hour request closed without a confirmed payment.`,
                },
            };
        case 'provider_error':
            return {
                ...base,
                scene,
                eyebrow: 'Connection status',
                hero: { text: 'Retry needed', suffix: null },
                pill: {
                    label: input.online ? 'Provider unavailable' : 'Offline',
                    tone: 'warning',
                },
                action: null,
                remains: PAYMENT_REMAINS(hours),
                safeNext:
                    'Do not submit duplicate payments. Try again when the connection or provider recovers.',
                policy: 'Your access is unchanged while payment status is unavailable.',
                banner: {
                    tone: 'error',
                    title: 'Payment status unavailable',
                    body: 'Your connection or the payment provider is unavailable. Access is unchanged.',
                },
            };
        case 'confirmed':
            return {
                ...base,
                scene,
                eyebrow: 'Verified payment',
                pill: { label: 'Confirmed', tone: 'success' },
                nextDate: date('confirmed'),
                action: { kind: 'operations', label: 'Return to operations' },
                safeNext:
                    'The paid-through date is server-calculated. Your business stays open.',
                policy: 'Keep your confirmation: it matches the payment PayMongo verified.',
                banner: {
                    tone: 'success',
                    title: 'Payment received and verified',
                    body: 'PayMongo confirmed the payment and the server updated your entitlement.',
                },
            };
    }
}
