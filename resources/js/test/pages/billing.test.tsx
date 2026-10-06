import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import Billing from '@/pages/owner/settings/billing';
import { ACTIVE_ENTITLEMENT, BILLING_URL } from '@/test/fixtures/entitlement';
import { inertia, resetInertia } from '@/test/inertia';
import type { BillingPageData, BillingUrls } from '@/types/billing';
import type { Entitlement, OwnerPageProps } from '@/types/owner';

vi.mock('@inertiajs/react', async () =>
    (await import('@/test/inertia')).inertiaModule(),
);

const NOW = new Date('2026-10-05T00:00:00Z');
const organization: OwnerPageProps['organization'] = {
    id: 1,
    name: 'Shine',
    slug: 'shine',
    publishedAt: null,
    shopUrl: 'x',
    operationsUrl: '/owner/organizations/1/operations',
    conflictsUrl: '/owner/organizations/1/scheduling-conflicts',
    unresolvedConflicts: 0,
    bookingRequestsUrl: '/owner/organizations/1/booking-requests',
    baseUrl: '/owner/organizations/1/settings',
    billingUrl: BILLING_URL,
};
const urls: BillingUrls = {
    renewal: `${BILLING_URL}/renewal`,
    billing: BILLING_URL,
    closure: '/owner/organizations/1/settings/closure',
    recover: '/owner/organizations/1/settings/closure/recover',
};
const billing: BillingPageData = {
    plan: { amountCentavos: 99900, currency: 'PHP', requestLifetimeHours: 24 },
    billingAvailable: true,
    request: null,
    lastRequestExpiredAt: null,
    lastPayment: null,
    closureRecoveryDays: 90,
};

function renderBilling(
    over: {
        billing?: Partial<BillingPageData>;
        entitlement?: Partial<Entitlement>;
        errors?: Record<string, string>;
    } = {},
) {
    const props = {
        appName: 'Rinquo',
        auth: { user: { email: 'owner@example.test' } },
        flash: { status: null },
        displayTimezone: 'Asia/Manila',
        errors: over.errors ?? {},
        organization,
        readiness: { isReady: true, items: [] },
        entitlement: { ...ACTIVE_ENTITLEMENT, ...over.entitlement },
        billing: { ...billing, ...over.billing },
        urls,
    };
    resetInertia(props, BILLING_URL);

    return render(
        <Billing
            {...(props as unknown as React.ComponentProps<typeof Billing>)}
        />,
    );
}

const openRequest = (
    extra: Partial<NonNullable<BillingPageData['request']>> = {},
) => ({
    id: 'req-1',
    amountCentavos: 99900,
    expiresAt: '2026-10-06T00:00:00Z',
    qrImage: 'data:image/png;base64,AAAA',
    qrExpiresAt: '2026-10-05T00:30:00Z',
    providerError: false,
    ...extra,
});

describe('Billing page', () => {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: [
                'Date',
                'setInterval',
                'clearInterval',
                'setTimeout',
                'clearTimeout',
            ],
        });
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it('does not wrap itself in the Owner shell (the layout resolver assigns it)', () => {
        const { container } = renderBilling();

        expect(screen.queryByRole('banner')).not.toBeInTheDocument();
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { level: 1 }),
        ).not.toBeInTheDocument();
        expect(container.querySelectorAll('main')).toHaveLength(0);
    });

    it('shows exact amount, state and the dates entitlement is derived from', () => {
        renderBilling({ entitlement: { state: 'trial', paidUntil: null } });

        expect(screen.getByText('Free trial')).toBeInTheDocument();
        expect(screen.getByText(/₱999 per month/)).toBeInTheDocument();
        expect(screen.getByText('Trial ends')).toBeInTheDocument();
        expect(screen.getByText('Paid through').nextSibling).toHaveTextContent(
            'Not set',
        );
        expect(
            screen.getByText(/starts when the trial ends/),
        ).toBeInTheDocument();
    });

    it.each([
        ['paid', /paid through/i],
        ['grace', /grace period/i],
        ['restricted', /new bookings and configuration changes are paused/i],
    ] as const)('explains the %s state truthfully', (state, text) => {
        renderBilling({ entitlement: { state } });

        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    });

    it('offers one primary action to generate a QR, labelled while the provider works', () => {
        renderBilling();
        fireEvent.click(
            screen.getByRole('button', { name: 'Generate renewal QR' }),
        );

        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'post',
            url: urls.renewal,
        });
    });

    it('shows a live QR with its own countdown and does not offer a refresh', () => {
        renderBilling({ billing: { request: openRequest() } });

        expect(
            screen.getByAltText('QR Ph code to pay ₱999'),
        ).toBeInTheDocument();
        expect(screen.getByRole('timer')).toHaveTextContent('30:00');
        expect(
            screen.queryByRole('button', { name: /refresh|generate/i }),
        ).not.toBeInTheDocument();
        expect(screen.getByText(/Waiting for payment/)).toBeInTheDocument();
        expect(screen.getByText(/Do not pay twice/)).toBeInTheDocument();
    });

    it('polls the server for the confirmed outcome while a request is open', () => {
        renderBilling({ billing: { request: openRequest() } });
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'get',
            url: urls.billing,
        });
        expect(inertia.calls.at(-1)?.options).toMatchObject({
            only: ['billing', 'entitlement'],
        });
    });

    it('turns an expired QR into a refresh within the still-open request', () => {
        renderBilling({
            billing: {
                request: openRequest({
                    qrImage: null,
                    qrExpiresAt: '2026-10-04T23:00:00Z',
                }),
            },
        });

        expect(
            screen.getByText(/QR code on screen has expired/),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh QR' }));
        expect(inertia.calls.at(-1)).toMatchObject({
            url: urls.renewal,
            data: { refresh: 1 },
        });
    });

    it('distinguishes a provider failure from an unpaid expiry and never claims success', () => {
        renderBilling({
            billing: {
                request: openRequest({
                    qrImage: null,
                    qrExpiresAt: null,
                    providerError: true,
                }),
            },
        });

        expect(screen.getByRole('alert')).toHaveTextContent(
            /not been charged/i,
        );
        expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
        expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
    });

    it('says an expired request means no payment was made', () => {
        renderBilling({
            billing: { lastRequestExpiredAt: '2026-10-04T00:00:00Z' },
        });

        expect(screen.getByText(/without a payment/)).toBeInTheDocument();
        expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    });

    it('fails closed with an honest message when the provider is not configured', () => {
        renderBilling({ billing: { billingAvailable: false } });

        expect(
            screen.getByText('Online renewal is unavailable'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Generate renewal QR' }),
        ).toBeDisabled();
        expect(screen.getByText('Plan and access')).toBeInTheDocument();
    });

    it('keeps the confirmed payment as a durable result with a continuation', () => {
        renderBilling({
            billing: {
                lastPayment: {
                    amountCentavos: 99900,
                    paidAt: '2026-10-05T01:00:00Z',
                    paidUntil: '2026-11-19T00:00:00Z',
                },
            },
        });

        const result = screen
            .getByText('Payment received')
            .closest('[data-slot="alert"]') as HTMLElement;
        expect(
            within(result).getByText(/₱999 for Shine was confirmed/),
        ).toBeInTheDocument();
        expect(
            within(result).getByRole('link', { name: /continue to today/i }),
        ).toHaveAttribute('href', '/owner/organizations/1/operations');
    });

    it('shows a server renewal error without losing the plan context', () => {
        renderBilling({
            errors: { billing: 'The payment provider is not responding.' },
        });

        expect(
            screen.getByText('The payment provider is not responding.'),
        ).toBeInTheDocument();
        expect(screen.getByText('Plan and access')).toBeInTheDocument();
    });

    it('explains the renewal request lifetime on screen', () => {
        renderBilling({ billing: { request: openRequest() } });

        expect(screen.getByText(/stays open until/)).toBeInTheDocument();
    });
});

describe('Closure section', () => {
    beforeEach(() => vi.setSystemTime(NOW));

    it('is separate from billing, never worded as cancelling a subscription, and needs the typed name', () => {
        renderBilling();
        const section = screen
            .getByRole('heading', { name: 'Close organization' })
            .closest('[data-slot="card"]') as HTMLElement;

        expect(
            within(section).getByText(
                /not the same as letting your subscription lapse/,
            ),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/cancel subscription/i),
        ).not.toBeInTheDocument();

        fireEvent.click(
            within(section).getByRole('button', { name: 'Close organization' }),
        );
        const dialog = screen.getByRole('dialog');
        const submit = within(dialog).getByRole('button', {
            name: 'Close organization',
        });
        expect(submit).toBeDisabled();
        expect(within(dialog).getByText(/for 90 days/)).toBeInTheDocument();

        fireEvent.change(
            within(dialog).getByLabelText(/Type "Shine" to confirm/),
            { target: { value: 'Shin' } },
        );
        expect(submit).toBeDisabled();
        fireEvent.change(
            within(dialog).getByLabelText(/Type "Shine" to confirm/),
            { target: { value: 'Shine' } },
        );
        expect(submit).toBeEnabled();
        fireEvent.click(submit);

        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'post',
            url: urls.closure,
            data: { confirmation: 'Shine' },
        });
    });

    it('lets a recoverable closure be recovered and names the exact deadline and what is kept', () => {
        renderBilling({
            entitlement: {
                closed: true,
                acceptsNewBookings: false,
                closure: {
                    state: 'recoverable',
                    requestedAt: '2026-10-01T00:00:00Z',
                    recoverableUntil: '2026-12-30T00:00:00Z',
                    deletionEligibleAt: null,
                },
            },
        });

        expect(
            screen.getByText(/Recoverable until December 30, 2026/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Bookings, customers, staff accounts/),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Recover organization' }),
        );
        expect(inertia.calls.at(-1)).toMatchObject({
            method: 'post',
            url: urls.recover,
        });
    });

    it('removes recovery at deletion eligibility without implying data was deleted', () => {
        renderBilling({
            entitlement: {
                closed: true,
                acceptsNewBookings: false,
                closure: {
                    state: 'deletion_eligible',
                    requestedAt: '2026-06-01T00:00:00Z',
                    recoverableUntil: '2026-08-30T00:00:00Z',
                    deletionEligibleAt: '2026-08-30T00:00:00Z',
                },
            },
        });

        expect(
            screen.queryByRole('button', { name: 'Recover organization' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(/Platform Operations now handles retention/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been deleted automatically/),
        ).toBeInTheDocument();
    });
});
