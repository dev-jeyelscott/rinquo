import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useNow } from '@/hooks/use-now';
import { formatDayAndTime } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import type { BookingRequest } from '@/types/booking';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & {
    requests: BookingRequest[];
    pagination: { previousUrl: string | null; nextUrl: string | null };
};

/** "1 h 5 min left" / "Less than a minute left" / "Expired". */
function timeLeft(expiresAt: string, now: number): string {
    const minutes = Math.floor((new Date(expiresAt).getTime() - now) / 60000);

    if (minutes < 0) {
        return 'Expired';
    }
    if (minutes === 0) {
        return 'Less than a minute left';
    }

    const hours = Math.floor(minutes / 60);

    return `${hours > 0 ? `${hours} h ` : ''}${minutes % 60} min left`;
}

/**
 * Pending booking requests for staff-approval shops. Approve is the routine
 * primary action; Decline is consequential, so it asks for confirmation in a
 * modal with an optional reason. Both are decided on the server, which refuses
 * a request that expired or was decided in the meantime.
 */
export default function BookingRequests({
    organization,
    requests,
    pagination,
}: Props) {
    const { props } = usePage<{ errors?: Record<string, string> }>();
    const now = useNow(30_000);
    const error = props.errors?.booking;

    return (
        <>
            <Head title="Booking requests" />
            <div className="grid max-w-3xl gap-4">
                {error ? (
                    <Alert className={ALERT_TONES.error}>
                        <AlertDescription>
                            <p>{error}</p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {requests.length === 0 ? (
                    <Card className="rounded-2xl py-6 shadow-none">
                        <CardContent className="grid gap-1 px-6">
                            <h2 className="text-xl font-semibold">
                                No requests waiting
                            </h2>
                            <p className="max-w-[66ch] text-sm text-muted-foreground">
                                When a customer asks for a time and your shop
                                approves bookings, the request appears here
                                until you decide or it expires.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <ul aria-label="Pending requests" className="grid gap-3">
                        {requests.map((request) => (
                            <RequestRow
                                key={request.id}
                                request={request}
                                now={now}
                                baseUrl={`${organization.bookingRequestsUrl}/${request.id}`}
                            />
                        ))}
                    </ul>
                )}

                {pagination.previousUrl || pagination.nextUrl ? (
                    <nav aria-label="Pagination" className="flex gap-3 text-sm">
                        {pagination.previousUrl ? (
                            <Link
                                href={pagination.previousUrl}
                                className="text-primary underline underline-offset-4"
                            >
                                Previous requests
                            </Link>
                        ) : null}
                        {pagination.nextUrl ? (
                            <Link
                                href={pagination.nextUrl}
                                className="text-primary underline underline-offset-4"
                            >
                                More requests
                            </Link>
                        ) : null}
                    </nav>
                ) : null}
            </div>
        </>
    );
}

function RequestRow({
    request,
    now,
    baseUrl,
}: {
    request: BookingRequest;
    now: number;
    baseUrl: string;
}) {
    const [approving, setApproving] = useState(false);
    const when = formatDayAndTime(request.startAt, request.timezone);

    return (
        <li>
            <Card className="rounded-2xl py-4 shadow-none">
                <CardContent className="grid gap-3 px-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-lg font-semibold">
                            {request.customerName}
                        </h2>
                        <p className="text-sm font-semibold tabular-nums">
                            {timeLeft(request.pendingExpiresAt, now)}
                        </p>
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <Detail label="Service" value={request.serviceName} />
                        <Detail
                            label="Vehicle"
                            value={
                                request.vehiclePlate
                                    ? `${request.vehicleName} (${request.vehiclePlate})`
                                    : request.vehicleName
                            }
                        />
                        <Detail
                            label="Time"
                            value={`${when} (Philippine time)`}
                        />
                        <Detail
                            label="Respond by"
                            value={formatDayAndTime(
                                request.pendingExpiresAt,
                                request.timezone,
                            )}
                        />
                        {request.addOns.length > 0 ? (
                            <Detail
                                label="Add-ons"
                                value={request.addOns.join(', ')}
                            />
                        ) : null}
                        <Detail
                            label="Contact"
                            value={[
                                request.customerEmail,
                                request.customerPhone,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        />
                        {request.notes ? (
                            <Detail label="Notes" value={request.notes} />
                        ) : null}
                    </dl>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            aria-label={`Approve ${request.customerName}'s request`}
                            className="max-sm:h-11"
                            disabled={approving}
                            aria-busy={approving}
                            onClick={() =>
                                router.post(
                                    `${baseUrl}/approve`,
                                    {},
                                    {
                                        preserveScroll: true,
                                        onStart: () => setApproving(true),
                                        onFinish: () => setApproving(false),
                                    },
                                )
                            }
                        >
                            {approving ? (
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {approving ? 'Approving…' : 'Approve'}
                        </Button>
                        <ConfirmAction
                            label="Decline"
                            ariaLabel={`Decline ${request.customerName}'s request`}
                            title={`Decline ${request.customerName}'s request?`}
                            description={`The customer is emailed and ${when} is released. This cannot be undone.`}
                            confirmLabel="Decline request"
                            reasonLabel="Reason (optional, kept in the audit log)"
                            url={`${baseUrl}/decline`}
                        />
                    </div>
                </CardContent>
            </Card>
        </li>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words tabular-nums">{value}</dd>
        </div>
    );
}
