import { router } from '@inertiajs/react';
import { CheckCircle2Icon, CircleAlertIcon, WifiOffIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
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
}: Props) {
    const online = useOnline();
    const now = useNow(1000);
    const [pending, setPending] = useState(false);
    const request = billing.request;
    const qrExpiresAt = request?.qrExpiresAt
        ? Date.parse(request.qrExpiresAt)
        : null;
    const qrLive =
        request?.qrImage != null && qrExpiresAt !== null && qrExpiresAt > now;
    const requestOpen = request !== null && Date.parse(request.expiresAt) > now;

    useEffect(() => {
        if (!requestOpen || !online) {
            return;
        }
        const timer = window.setInterval(() => {
            router.get(
                urls.billing,
                {},
                {
                    only: ['billing', 'entitlement'],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, [requestOpen, online, urls.billing]);

    function ask(refresh: boolean) {
        router.post(urls.renewal, refresh ? { refresh: 1 } : {}, {
            preserveScroll: true,
            onStart: () => setPending(true),
            onFinish: () => setPending(false),
        });
    }

    const label = request?.providerError
        ? 'Try again'
        : request
          ? 'Refresh QR'
          : 'Generate renewal QR';

    return (
        <SectionCard
            title="Renew"
            description={`Pay ${formatCentavos(billing.plan.amountCentavos)} with any QR Ph banking or e-wallet app. Access changes only after PayMongo confirms the payment.`}
        >
            <div className="grid gap-4">
                {billing.lastPayment ? (
                    <Alert className={ALERT_TONES.success} role="status">
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
                    <Alert className={ALERT_TONES.warning} role="status">
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
                    <Alert className={ALERT_TONES.warning} role="status">
                        <WifiOffIcon aria-hidden="true" />
                        <AlertDescription>
                            <p>
                                You are offline. Payment status updates when you
                                reconnect.
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {requestOpen && request ? (
                    <div className="grid gap-3">
                        {qrLive && request.qrImage ? (
                            <div className="grid justify-items-start gap-2">
                                <img
                                    src={request.qrImage}
                                    alt={`QR Ph code to pay ${formatCentavos(request.amountCentavos)}`}
                                    className="size-56 rounded-lg border bg-white p-2"
                                />
                                <p
                                    role="timer"
                                    className="text-sm text-muted-foreground"
                                >
                                    This QR code works for another{' '}
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatRemaining(
                                            (qrExpiresAt ?? now) - now,
                                        )}
                                    </span>
                                    .
                                </p>
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
                        ) : (
                            <p className="text-sm text-muted-foreground">
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
                        QR to renew.
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                    {requestOpen && qrLive ? null : (
                        <Button
                            className="max-sm:h-11"
                            onClick={() => ask(Boolean(request))}
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
                    {requestOpen && qrLive ? (
                        <p
                            className="text-sm text-muted-foreground"
                            role="status"
                        >
                            Waiting for payment. This page updates by itself
                            once PayMongo confirms it.
                        </p>
                    ) : null}
                </div>
            </div>
        </SectionCard>
    );
}
