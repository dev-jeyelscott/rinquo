import { router } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    CircleAlertIcon,
    CircleDotIcon,
    CircleIcon,
    WifiOffIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SectionCard } from '@/components/owner/section-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useNow } from '@/hooks/use-now';
import { useOnline } from '@/hooks/use-online';
import { formatDate, formatDateTime, formatRemaining } from '@/lib/billing';
import { formatCentavos } from '@/lib/money';
import { ALERT_TONES } from '@/lib/tones';
import type { BillingPageData, BillingUrls } from '@/types/billing';

type Props = {
    billing: BillingPageData;
    urls: BillingUrls;
    timezone: string;
    organizationName: string;
    operationsUrl: string;
    errorMessage?: string;
    /** False when a visible banner already announces the request state. */
    announceStatus?: boolean;
};

const POLL_MS = 5000;

/**
 * Renewal by PayMongo QR Ph. The server owns the amount and every date; this
 * card only asks for a QR and then reads status back. Access changes only when
 * the provider confirms payment, so the card never claims success on its own
 * and polls the server while a request is open.
 */
export function RenewalCard({
    billing,
    urls,
    timezone,
    organizationName,
    operationsUrl,
    errorMessage,
    announceStatus = true,
}: Props) {
    const online = useOnline();
    const now = useNow(1000);
    const [pending, setPending] = useState(false);
    const [checking, setChecking] = useState(false);
    const request = billing.request;
    const qrExpiresAt = request?.qrExpiresAt
        ? Date.parse(request.qrExpiresAt)
        : null;
    const qrLive =
        request?.qrImage != null && qrExpiresAt !== null && qrExpiresAt > now;
    const requestOpen = request !== null && Date.parse(request.expiresAt) > now;

    const inFlight = useRef(false);

    // Status polling is a partial reload of server truth. It pauses while offline or
    // while the tab is hidden and never starts a visit while the previous one is running.
    const refreshStatus = useCallback(() => {
        if (inFlight.current) {
            return;
        }
        router.get(
            urls.billing,
            {},
            {
                only: ['billing', 'entitlement'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => {
                    inFlight.current = true;
                    setChecking(true);
                },
                onFinish: () => {
                    inFlight.current = false;
                    setChecking(false);
                },
            },
        );
    }, [urls.billing]);

    useEffect(() => {
        if (!requestOpen || !online) {
            return;
        }
        const timer = window.setInterval(() => {
            if (!document.hidden) {
                refreshStatus();
            }
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, [requestOpen, online, refreshStatus]);

    function ask(refresh: boolean) {
        router.post(urls.renewal, refresh ? { refresh: 1 } : {}, {
            preserveScroll: true,
            onStart: () => setPending(true),
            onFinish: () => setPending(false),
        });
    }

    const prepared =
        requestOpen &&
        !qrLive &&
        !request?.providerError &&
        request?.qrExpiresAt === null;
    const label = request?.providerError
        ? 'Try again'
        : request
          ? prepared
              ? 'Generate renewal QR'
              : 'Refresh QR'
          : billing.lastRequestExpiredAt
            ? 'Generate new request'
            : 'Generate renewal QR';
    // One short, stable phrase per payment state: announced only when it changes.
    // A visible alert or banner already announces the provider error and the scene states.
    const announcement =
        !announceStatus || !requestOpen || request?.providerError
            ? ''
            : qrLive
              ? 'Waiting for verified payment'
              : prepared
                ? 'Renewal request ready'
                : 'The QR code expired';

    return (
        <SectionCard
            id="renewal"
            tabIndex={-1}
            role="region"
            aria-labelledby="renewal-heading"
            titleId="renewal-heading"
            title="Renewal payment"
            description={`Pay ${formatCentavos(billing.plan.amountCentavos)} with any QR Ph banking or e-wallet app. Access changes only after PayMongo confirms the payment.`}
            className="scroll-mt-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
            <p role="status" className="sr-only">
                {announcement}
            </p>
            <div className="grid gap-4">
                {billing.lastPayment ? (
                    <Alert className={ALERT_TONES.success}>
                        <CheckCircle2Icon aria-hidden="true" />
                        <AlertTitle>Payment received</AlertTitle>
                        <AlertDescription>
                            <p className="max-w-[65ch]">
                                {formatCentavos(
                                    billing.lastPayment.amountCentavos,
                                )}{' '}
                                for {organizationName} was confirmed on{' '}
                                <span className="tabular-nums">
                                    {formatDate(
                                        billing.lastPayment.paidAt,
                                        timezone,
                                    )}
                                </span>
                                . Access is paid through{' '}
                                <span className="font-semibold tabular-nums">
                                    {formatDateTime(
                                        billing.lastPayment.paidUntil,
                                        timezone,
                                    )}
                                </span>
                                .
                            </p>
                            <a
                                href={operationsUrl}
                                className="w-fit text-primary underline underline-offset-4"
                            >
                                Continue to today&rsquo;s operations
                            </a>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {errorMessage ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertTitle>Renewal is not ready</AlertTitle>
                        <AlertDescription>
                            <p>{errorMessage}</p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {!billing.billingAvailable ? (
                    <Alert className={ALERT_TONES.warning}>
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertTitle>Online renewal is unavailable</AlertTitle>
                        <AlertDescription>
                            <p>
                                Your current access is unchanged. Try again
                                later.
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {!online ? (
                    <Alert className={ALERT_TONES.warning}>
                        <WifiOffIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>
                                You are offline. Payment status updates when you
                                reconnect. Do not pay again while the status is
                                unknown.
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {requestOpen && request ? (
                    <div className="grid gap-4">
                        {qrLive && request.qrImage ? (
                            <div className="flex flex-wrap items-start gap-5">
                                <img
                                    src={request.qrImage}
                                    alt={`QR Ph code to pay ${formatCentavos(request.amountCentavos)}`}
                                    className="size-52 shrink-0 rounded-lg border bg-white p-2"
                                />
                                <div className="grid min-w-0 gap-1.5 text-sm">
                                    <p className="font-semibold">
                                        Payment request
                                    </p>
                                    <p className="tabular-nums">
                                        One month &middot;{' '}
                                        {formatCentavos(request.amountCentavos)}
                                    </p>
                                    <p
                                        role="timer"
                                        aria-live="off"
                                        className="text-muted-foreground"
                                    >
                                        QR active. This code works for another{' '}
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {formatRemaining(
                                                (qrExpiresAt ?? now) - now,
                                            )}
                                        </span>
                                        .
                                    </p>
                                    <p className="text-muted-foreground tabular-nums">
                                        Request expires:{' '}
                                        {formatDateTime(
                                            request.expiresAt,
                                            timezone,
                                        )}
                                    </p>
                                </div>
                            </div>
                        ) : request.providerError ? (
                            <Alert className={ALERT_TONES.error} role="alert">
                                <CircleAlertIcon aria-hidden="true" />
                                <AlertTitle>
                                    We could not prepare a QR code
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        The payment provider did not respond.
                                        You have not been charged. Try again.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        ) : prepared ? (
                            <p className="max-w-[65ch] text-sm text-muted-foreground">
                                Your renewal request is ready. Generate a QR
                                code to pay.
                            </p>
                        ) : (
                            <p className="max-w-[65ch] text-sm text-muted-foreground">
                                The QR code on screen has expired. Refresh it to
                                pay; your renewal request is still open.
                            </p>
                        )}
                        <p className="max-w-[65ch] text-sm text-muted-foreground">
                            This renewal request stays open until{' '}
                            <span className="tabular-nums">
                                {formatDateTime(request.expiresAt, timezone)}
                            </span>
                            . Each QR code lasts only a short time, so refresh
                            it if it expires. Do not pay twice.
                        </p>
                        <ConfirmationSteps />
                    </div>
                ) : billing.lastRequestExpiredAt ? (
                    <p className="max-w-[65ch] text-sm text-muted-foreground">
                        Your last renewal request closed on{' '}
                        <span className="tabular-nums">
                            {formatDateTime(
                                billing.lastRequestExpiredAt,
                                timezone,
                            )}
                        </span>{' '}
                        without a payment. Nothing was charged. Generate a new
                        request to renew.
                    </p>
                ) : (
                    <p className="max-w-[65ch] text-sm text-muted-foreground">
                        Generating a request creates a{' '}
                        {billing.plan.requestLifetimeHours}
                        -hour payment request for one month at the plan price.
                        Nothing is charged until you pay.
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    {requestOpen && qrLive ? null : (
                        <Button
                            className="min-w-52 justify-center max-sm:h-11"
                            onClick={() => ask(Boolean(request) && !prepared)}
                            disabled={
                                pending || !online || !billing.billingAvailable
                            }
                            aria-busy={pending}
                        >
                            {pending ? (
                                <>
                                    <Spinner aria-hidden="true" /> Preparing
                                    your QR code...
                                </>
                            ) : (
                                label
                            )}
                        </Button>
                    )}
                    {requestOpen ? (
                        <Button
                            variant="outline"
                            className="max-sm:h-11"
                            onClick={refreshStatus}
                            disabled={checking || !online}
                            aria-busy={checking}
                        >
                            Refresh status
                        </Button>
                    ) : null}
                </div>
            </div>
        </SectionCard>
    );
}

/**
 * The three honest facts about an open request, derived only from what the
 * server already exposes: a request exists, no payment is established, and
 * access changes only after a signed webhook. It never reports a payment.
 */
function ConfirmationSteps() {
    const steps = [
        {
            icon: CheckCircle2Icon,
            title: 'Request created',
            detail: 'Rinquo requested a PayMongo QR',
            done: true,
        },
        {
            icon: CircleDotIcon,
            title: 'Provider confirmation pending',
            detail: 'No payment has been established',
            done: false,
        },
        {
            icon: CircleIcon,
            title: 'Entitlement updated',
            detail: 'Only after signed webhook processing',
            done: false,
        },
    ];

    return (
        <ol className="grid gap-3 text-sm" aria-label="Payment progress">
            {steps.map(({ icon: Icon, title, detail, done }) => (
                <li key={title} className="flex items-start gap-3">
                    <Icon
                        aria-hidden="true"
                        className={
                            done
                                ? 'mt-0.5 size-4 shrink-0 text-success'
                                : 'mt-0.5 size-4 shrink-0 text-muted-foreground'
                        }
                    />
                    <span className="grid">
                        <span className="font-semibold">
                            {title}
                            <span className="sr-only">
                                {done ? ' (done)' : ' (not yet)'}
                            </span>
                        </span>
                        <span className="text-muted-foreground">{detail}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}
