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
    plan: {
        amountCentavos: 99900,
        currency: 'PHP',
        requestLifetimeHours: 24,
        graceDays: 3,
    },
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
        expect(screen.getByText('₱999')).toBeInTheDocument();
        expect(screen.getByText('Trial')).toBeInTheDocument();
        expect(
            screen.getByText('Next important date').nextSibling,
        ).toHaveTextContent('Trial ends Oct 19, 2026');
        expect(
            screen.getByText(/starts when the trial ends/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Start payment' }),
        ).toHaveAttribute('href', '#renewal');
        expect(screen.getByText('3 days (paid only)')).toBeInTheDocument();
    });

    it.each([
        ['paid', /paid through/i],
        ['grace', /grace active/i],
        ['restricted', /new bookings and configuration writes are paused/i],
    ] as const)('explains the %s state truthfully', (state, text) => {
        renderBilling({ entitlement: { state } });

        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    });

    it('shows only the plan-card action until a renewal is started, then reveals the named renewal region', () => {
        renderBilling();

        expect(
            screen.queryByRole('button', { name: 'Generate renewal QR' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('region', { name: 'Renewal payment' }),
        ).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('link', { name: 'View renewal options' }),
        );

        expect(
            screen.getByRole('region', { name: 'Renewal payment' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Generate renewal QR' }),
        ).toBeInTheDocument();
    });

    it('does not announce a provider error twice', () => {
        renderBilling({
            billing: {
                request: openRequest({
                    qrImage: null,
                    qrExpiresAt: null,
                    providerError: true,
                }),
            },
        });

        expect(
            screen.queryByText('The QR code could not be prepared'),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText('We could not prepare a QR code'),
        ).toBeInTheDocument();
    });

    it('offers one primary action to generate a QR, labelled while the provider works', () => {
        renderBilling({
            billing: {
                request: openRequest({ qrImage: null, qrExpiresAt: null }),
            },
        });
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
            screen.queryByRole('button', { name: /refresh QR|generate/i }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('QR Ph payment is ready')).toBeInTheDocument();
        expect(
            screen.getAllByText(/Waiting for verified payment/).length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/Do not pay twice/).length).toBeGreaterThan(
            0,
        );
        // Never a success claim from a QR alone.
        expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
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
        expect(
            screen.getAllByText(/Nothing was charged/).length,
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole('button', { name: 'Generate new request' }),
        ).toBeEnabled();
    });

    it('fails closed with an honest message when the provider is not configured', () => {
        renderBilling({ billing: { billingAvailable: false } });

        expect(
            screen.getByText('Online renewal is unavailable'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Generate renewal QR' }),
        ).toBeDisabled();
        expect(screen.getByText('Current plan & access')).toBeInTheDocument();
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
        expect(screen.getByText('Current plan & access')).toBeInTheDocument();
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
            screen.getByText(/contact Rinquo Platform Operations/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Nothing has been deleted automatically/),
        ).toBeInTheDocument();
    });
});

describe('Billing states from the approved Spec 07 references', () => {
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
    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(document, 'hidden', {
            value: false,
            configurable: true,
        });
    });

    it('treats an unpaid trial that ended as restricted, never as grace', () => {
        renderBilling({
            entitlement: {
                state: 'restricted',
                acceptsNewBookings: false,
                allowsConfigurationWrites: false,
                trialEndsAt: '2026-10-04T00:00:00Z',
                paidUntil: null,
                graceEndsAt: null,
            },
        });

        expect(screen.getByText('Subscription restricted')).toBeInTheDocument();
        expect(
            screen.getByText(/Your free trial ended on October 4, 2026/),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Next important date').nextSibling,
        ).toHaveTextContent('Trial ended Oct 4, 2026');
        expect(
            screen.getByRole('link', { name: 'Renew using QR Ph' }),
        ).toHaveAttribute('href', '#renewal');
        expect(
            screen.queryByText(/grace/i, { selector: 'dd, h2, h3' }),
        ).not.toBeInTheDocument();
        expect(screen.getAllByText('Restricted').length).toBeGreaterThan(0);
    });

    it('shows grace for a paid period only, with its exact deadline and the guarantees', () => {
        renderBilling({
            entitlement: {
                state: 'grace',
                paidUntil: '2026-10-04T00:00:00Z',
                graceEndsAt: '2026-10-07T00:00:00Z',
            },
        });

        expect(
            screen.getByText('Paid period ended: grace active'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Grace ends Oct 7, 2026, 8:00 AM'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Renew now' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Early renewal extends the paid-through date'),
        ).toBeInTheDocument();
    });

    it('warns about an upcoming renewal inside seven days', () => {
        renderBilling({
            entitlement: {
                state: 'paid',
                trialEndsAt: '2026-09-20T00:00:00Z',
                paidUntil: '2026-10-08T00:00:00Z',
            },
        });

        expect(screen.getByText('Renewal coming up')).toBeInTheDocument();
        expect(screen.getByText('Renewal due in 3 days')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Renew with QR Ph' }),
        ).toBeInTheDocument();
    });

    it('offers to generate a QR for an open request that has none yet, without calling it expired', () => {
        renderBilling({
            billing: {
                request: openRequest({ qrImage: null, qrExpiresAt: null }),
            },
        });

        expect(
            screen.getByText(/Your renewal request is ready/),
        ).toBeInTheDocument();
        expect(screen.queryByText(/has expired/)).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Generate renewal QR' }),
        ).toBeEnabled();
    });

    it('lists what is and is not established while a request is open, and never claims payment', () => {
        renderBilling({ billing: { request: openRequest() } });
        const steps = screen.getByRole('list', { name: 'Payment progress' });

        expect(within(steps).getByText('Request created')).toBeInTheDocument();
        expect(
            within(steps).getByText('Provider confirmation pending'),
        ).toBeInTheDocument();
        expect(
            within(steps).getByText('Entitlement updated'),
        ).toBeInTheDocument();
        expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
    });

    it('shows the verified result with one continuation once the server records the payment', () => {
        renderBilling({
            billing: {
                lastPayment: {
                    amountCentavos: 99900,
                    paidAt: '2026-10-04T23:00:00Z',
                    paidUntil: '2026-11-19T00:00:00Z',
                },
            },
        });

        expect(
            screen.getByText('Payment received and verified'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Return to operations' }),
        ).toHaveAttribute('href', '/owner/organizations/1/operations');
    });

    it('does not poll while the tab is hidden and never overlaps visits', () => {
        renderBilling({ billing: { request: openRequest() } });
        Object.defineProperty(document, 'hidden', {
            value: true,
            configurable: true,
        });
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);

        Object.defineProperty(document, 'hidden', {
            value: false,
            configurable: true,
        });
        inertia.nextGet = 'pending';
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(1);
        expect(
            screen.getByRole('button', { name: 'Refresh status' }),
        ).toBeDisabled();
    });

    it('stops polling and says payment status is unknown while offline', () => {
        const online = vi
            .spyOn(navigator, 'onLine', 'get')
            .mockReturnValue(false);
        renderBilling({ billing: { request: openRequest() } });
        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(
            inertia.calls.filter((call) => call.method === 'get'),
        ).toHaveLength(0);
        expect(screen.getByText(/You are offline/)).toBeInTheDocument();
        expect(
            screen.getByText('Payment status unavailable'),
        ).toBeInTheDocument();
        online.mockRestore();
    });

    it('hides renewal controls when the organization is closed and keeps recovery as the one action', () => {
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
            screen.queryByRole('button', { name: 'Generate renewal QR' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Recover organization' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Recovery restores only the subscription access currently valid.',
                { selector: 'p' },
            ),
        ).toBeInTheDocument();
    });
});
