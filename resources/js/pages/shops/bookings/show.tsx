import { Head, Link } from '@inertiajs/react';
import {
    ArrowRightIcon,
    ClockIcon,
    InfoIcon,
    RefreshCwIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { BookingCancellation } from '@/components/booking/booking-cancellation';
import { BookingJourneyHeader } from '@/components/booking/booking-journey-header';
import {
    BookingCutoffNotice,
    BookingManageCard,
    StayInformed,
} from '@/components/booking/booking-manage-card';
import { BookingSummaryPanel } from '@/components/booking/booking-summary-panel';
import { BookingLiveStatus } from '@/components/booking/booking-live-status';
import {
    BookingOutcome,
    outcomeOf,
} from '@/components/booking/booking-outcome';
import {
    BookingHistory,
    BookingProgress,
} from '@/components/booking/booking-progress';
import { BookingReschedule } from '@/components/booking/booking-reschedule';
import type { RescheduleStep } from '@/components/booking/booking-reschedule';
import {
    DetailRows,
    vehicleLabel,
} from '@/components/booking/booking-summary-card';
import type { DetailRow } from '@/components/booking/booking-summary-card';
import { RescheduleProposalCard } from '@/components/booking/reschedule-proposal-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { useBookingLive } from '@/hooks/use-booking-live';
import { useBookingManagement } from '@/hooks/use-booking-management';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { formatDayAndTime, formatLongDayAndTime } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { BookingPageProps } from '@/types/booking';

type View = 'overview' | 'cancel' | 'reschedule';
type Navigation = { id: string; view: View; step: RescheduleStep };

/**
 * The durable result of a booking, at its own URL. The approved Spec 02
 * outcome (`Booking confirmed` or `Request sent`) leads the page; the Spec 03
 * management region sits below it and never replaces it: a card that says
 * what the booking is and offers a choice (change the time or cancel), the
 * operational progress, history and a staff proposal, with the booking summary
 * beside it. Choosing starts a staged view (cancel; reschedule with its
 * three-stage indicator) that keeps the summary in view. The route owns what
 * those views share: the forms and their idempotency keys, the live link, the
 * view and the focus target. Everything shown comes from the server's
 * customer-safe booking, which carries no resource, capacity or buffer detail.
 */
export default function Show({
    shop,
    branch,
    booking,
    replacementDates,
    replacementAvailability,
    replacementNext,
    urls,
}: BookingPageProps) {
    const management = useBookingManagement(booking);
    // The outcome page is reached by navigation: announce it by focusing its heading once per booking.
    const heading = useFocusOnChange<HTMLHeadingElement>(booking.publicId, {
        onMount: true,
    });
    // Coming back from a staged view lands on the management card, never on the page start.
    const [returned, setReturned] = useState(0);
    const manageHeading = useFocusOnChange<HTMLHeadingElement>(returned);
    const live = useBookingLive(booking.publicId, booking.actions.deadlineAt);
    const [navigation, setNavigation] = useState<Navigation>({
        id: booking.publicId,
        view: 'overview',
        step: 'select',
    });
    // A staged view belongs to one booking and to an action that is still offered: a reschedule lands on
    // its replacement, and a cancelled or cut-off booking, back on the overview (with the outcome heading).
    const requested = navigation.id === booking.publicId ? navigation : null;
    const view: View =
        requested?.view === 'cancel' && booking.actions.canCancel
            ? 'cancel'
            : requested?.view === 'reschedule' && booking.actions.canReschedule
              ? 'reschedule'
              : 'overview';
    const step = requested?.step ?? 'select';
    const go = (next: View, nextStep: RescheduleStep = 'select') =>
        setNavigation({ id: booking.publicId, view: next, step: nextStep });
    const leave = () => {
        go('overview');
        setReturned((count) => count + 1);
    };
    // The outcome heading takes focus after the page is back on the overview (it is not rendered in a staged view).
    const [announce, setAnnounce] = useState(0);
    useEffect(() => {
        if (announce > 0) {
            heading.current?.focus();
        }
    }, [announce, heading]);
    const recover = () => {
        management.clearErrors();
        live.reload();
        go('overview');
        setAnnounce((count) => count + 1);
    };

    const pending = booking.status === 'pending_approval';
    const { actions } = booking;
    const manageable = actions.canCancel || actions.canReschedule;
    const open = booking.status === 'confirmed' || pending;
    const operational =
        booking.progress !== null &&
        !['scheduled', 'checked_in'].includes(booking.progress.state);
    const finished =
        booking.progress !== null &&
        ['completed', 'no_show'].includes(booking.progress.state);
    const cutoff = open && !manageable && !booking.proposal && !operational;
    const showProgress =
        booking.progress !== null && booking.progress.state !== 'scheduled';
    const showHistory =
        booking.history.length > 1 || booking.status !== 'confirmed';
    const location = [shop.name, branch.city].filter(Boolean).join(' · ');
    const vehicle = vehicleLabel(booking.vehicleName, booking.vehicleMakeModel);
    const service = [
        booking.serviceName,
        ...booking.addOns.map((addOn) => addOn.name),
    ].join(' + ');
    const rows: DetailRow[] = [
        ['Service', service],
        ['Vehicle', vehicle],
        [
            pending ? 'Requested start' : 'Start',
            formatLongDayAndTime(booking.startAt, booking.timezone),
        ],
        ...(pending && booking.pendingExpiresAt
            ? [
                  [
                      'Shop decision by',
                      formatLongDayAndTime(
                          booking.pendingExpiresAt,
                          booking.timezone,
                      ),
                  ] as DetailRow,
              ]
            : []),
        ['Duration', formatMinutes(booking.durationMinutes)],
        ...(pending
            ? []
            : [
                  [
                      'Service price',
                      formatCentavos(booking.totalCentavos),
                  ] as DetailRow,
              ]),
        ['Location', location],
    ];
    const reviewRows: DetailRow[] = [
        ['Service', service],
        ['Vehicle', vehicle],
        ['Location', location],
    ];
    const outcomeTitle = outcomeOf(booking).title;
    const liveStatus = (
        <BookingLiveStatus
            link={live.link}
            refresh={live.refresh}
            onRefresh={live.reload}
        />
    );
    const conflict = management.conflict ? (
        <Alert role="alert" className={ALERT_TONES.warning}>
            <RefreshCwIcon aria-hidden="true" />
            <AlertTitle>This booking changed</AlertTitle>
            <AlertDescription>
                <p>
                    It was updated while you were viewing it, so your change was
                    not applied. Load the latest details, then try again.
                </p>
                <Button
                    type="button"
                    variant="outline"
                    className="max-sm:h-11"
                    onClick={recover}
                >
                    Load latest details
                </Button>
            </AlertDescription>
        </Alert>
    ) : null;
    const summary = (
        <BookingSummaryPanel
            booking={booking}
            shopName={shop.name}
            addressLine={branch.addressLine}
            city={branch.city}
        />
    );
    const layout =
        'grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start';

    const header =
        view === 'cancel'
            ? ['Cancel booking', 'You can change your mind before you confirm']
            : view === 'reschedule'
              ? [
                    'Reschedule booking',
                    step === 'select'
                        ? 'Choose an available replacement time'
                        : 'Confirm the change before we check availability',
                ]
              : booking.proposal
                ? ['Proposed new time', 'The shop needs your response']
                : actions.restricted
                  ? ['Your booking', 'Some changes are temporarily unavailable']
                  : cutoff
                    ? [
                          'Your booking',
                          'Self-service changes are no longer available',
                      ]
                    : booking.progress?.state === 'in_service'
                      ? ['Your booking status', 'Live progress from the shop']
                      : booking.progress?.state === 'completed'
                        ? ['Your booking', 'Your completed appointment']
                        : [
                              'Your booking',
                              'Your appointment status and next steps',
                          ];

    return (
        <>
            <Head
                title={
                    view === 'overview' && !booking.proposal
                        ? outcomeTitle
                        : header[0]
                }
            />
            <div
                className={cn(
                    'grid grid-cols-[minmax(0,1fr)] gap-6',
                    (view !== 'overview' || manageable || booking.proposal) &&
                        'pb-36 lg:pb-0',
                )}
            >
                <BookingJourneyHeader
                    shopName={shop.name}
                    shopUrl={urls.shop}
                    title={header[0]}
                    subtitle={header[1]}
                    crumb="Your booking"
                    eyebrow="Your appointment"
                />

                {view === 'cancel' ? (
                    <div className={layout}>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                            {liveStatus}
                            {conflict}
                            <BookingCancellation
                                form={management.cancellation}
                                url={urls.cancel}
                                shopName={shop.name}
                                startAt={booking.startAt}
                                timezone={booking.timezone}
                                deadlineAt={actions.deadlineAt}
                                onKeep={leave}
                                onCancelled={() =>
                                    setAnnounce((count) => count + 1)
                                }
                            />
                        </div>
                        {summary}
                    </div>
                ) : null}

                {view === 'reschedule' ? (
                    <div className={layout}>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                            {liveStatus}
                            {conflict}
                            <BookingReschedule
                                key={booking.publicId}
                                form={management.reschedule}
                                url={urls.reschedule}
                                pageUrl={urls.booking}
                                startAt={booking.startAt}
                                timezone={booking.timezone}
                                summaryRows={reviewRows}
                                phone={branch.phone}
                                dates={replacementDates}
                                availability={replacementAvailability}
                                next={replacementNext}
                                step={step}
                                onStep={(next) => go('reschedule', next)}
                                onLeave={leave}
                            />
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                            {step === 'select' ? (
                                <Alert
                                    role={undefined}
                                    className={ALERT_TONES.info}
                                >
                                    <InfoIcon aria-hidden="true" />
                                    <AlertTitle>
                                        Your original appointment is safe
                                    </AlertTitle>
                                    <AlertDescription>
                                        It stays reserved until a replacement
                                        time is successfully confirmed.
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                            {summary}
                        </div>
                    </div>
                ) : null}

                {view === 'overview' && booking.proposal ? (
                    <div className={layout}>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                            {conflict}
                            <RescheduleProposalCard
                                key={`${booking.publicId}:${booking.proposal.id}`}
                                proposal={booking.proposal}
                                originalStartAt={booking.startAt}
                                timezone={booking.timezone}
                                acceptUrl={urls.acceptProposal}
                                declineUrl={urls.declineProposal}
                                heading={heading}
                                onAnswered={() =>
                                    setAnnounce((count) => count + 1)
                                }
                            />
                        </div>
                        {summary}
                    </div>
                ) : null}

                {view === 'overview' && !booking.proposal ? (
                    <>
                        <div className="mx-auto grid w-full max-w-[44rem] gap-5">
                            <BookingOutcome
                                booking={booking}
                                shopName={shop.name}
                                heading={heading}
                                rescheduledTo={urls.rescheduledTo}
                            />
                            <section
                                aria-labelledby="appointment-heading"
                                className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7"
                            >
                                <h3
                                    id="appointment-heading"
                                    className="text-lg font-semibold"
                                >
                                    {pending
                                        ? 'Awaiting shop approval'
                                        : 'Your appointment'}
                                </h3>
                                {pending ? (
                                    <p
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl border p-3 text-sm',
                                            ALERT_TONES.warning,
                                        )}
                                    >
                                        <ClockIcon
                                            aria-hidden="true"
                                            className="size-4 shrink-0"
                                        />
                                        Your requested time is temporarily held
                                        while {shop.name} reviews it.
                                    </p>
                                ) : null}
                                {booking.status === 'declined' ? (
                                    <p className="text-sm">
                                        The shop could not take this request,
                                        and the time is no longer reserved.
                                    </p>
                                ) : null}
                                {booking.status === 'expired' ? (
                                    <p className="text-sm">
                                        The shop did not respond in time, so the
                                        time is no longer reserved.
                                    </p>
                                ) : null}
                                {booking.rescheduledFrom &&
                                urls.rescheduledFrom ? (
                                    <p className="text-sm text-muted-foreground">
                                        Moved from{' '}
                                        <Link
                                            href={urls.rescheduledFrom}
                                            className="font-medium text-primary underline underline-offset-4"
                                        >
                                            {formatDayAndTime(
                                                booking.rescheduledFrom.startAt,
                                                booking.timezone,
                                            )}
                                        </Link>
                                        . Your service, add-ons and price are
                                        the same.
                                    </p>
                                ) : null}
                                <DetailRows rows={rows} />
                                {open ? (
                                    <p className="rounded-xl bg-secondary/70 p-3 text-sm text-muted-foreground">
                                        {pending
                                            ? `We'll email ${booking.contactEmail} when the shop approves or declines this request. If there is no decision by the deadline, the request expires and the time is released.`
                                            : `We'll send the details by email to ${booking.contactEmail}. Delivery is not guaranteed until processed.`}
                                    </p>
                                ) : null}
                                <p className="text-sm text-muted-foreground">
                                    {branch.addressLine}, {branch.city}
                                </p>
                            </section>

                            {manageable ? (
                                <BookingActionBar
                                    label="Next steps"
                                    inline
                                    back={{
                                        href: urls.shop,
                                        label: 'Back to shop',
                                    }}
                                >
                                    <a
                                        href="#manage-booking"
                                        className={buttonVariants()}
                                    >
                                        {pending
                                            ? 'Track request'
                                            : 'Manage booking'}
                                        <ArrowRightIcon aria-hidden="true" />
                                    </a>
                                </BookingActionBar>
                            ) : (
                                <div className="flex justify-center">
                                    <Link
                                        href={urls.shop}
                                        className={cn(
                                            buttonVariants(),
                                            'max-sm:h-11',
                                        )}
                                    >
                                        Back to {shop.name}
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div
                            id="manage-booking"
                            tabIndex={-1}
                            className={cn(layout, 'scroll-mt-4 outline-none')}
                        >
                            <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                                {manageable ? null : liveStatus}
                                {conflict}

                                {showProgress && booking.progress ? (
                                    <BookingProgress
                                        progress={booking.progress}
                                        timezone={booking.timezone}
                                    />
                                ) : null}

                                {manageable ? (
                                    <BookingManageCard
                                        booking={booking}
                                        shopName={shop.name}
                                        liveStatus={liveStatus}
                                        heading={manageHeading}
                                        onReschedule={() => go('reschedule')}
                                        onCancel={() => go('cancel')}
                                    />
                                ) : cutoff ? (
                                    <BookingCutoffNotice
                                        shopUrl={urls.shop}
                                        phone={branch.phone}
                                        closedAt={actions.closedAt}
                                        startAt={booking.startAt}
                                        timezone={booking.timezone}
                                    />
                                ) : actions.reason && !finished ? (
                                    <p className="text-sm text-muted-foreground">
                                        {actions.reason}
                                    </p>
                                ) : null}

                                {open && manageable ? (
                                    <StayInformed
                                        email={booking.contactEmail}
                                    />
                                ) : null}

                                {showHistory ? (
                                    <BookingHistory
                                        entries={booking.history}
                                        timezone={booking.timezone}
                                        note={
                                            booking.progress &&
                                            ['completed', 'no_show'].includes(
                                                booking.progress.state,
                                            )
                                                ? 'This is a historical record. Cancellation and rescheduling are no longer available.'
                                                : undefined
                                        }
                                    />
                                ) : null}
                            </div>
                            {summary}
                        </div>
                    </>
                ) : null}
            </div>
        </>
    );
}
