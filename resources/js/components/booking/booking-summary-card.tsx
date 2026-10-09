import { Card, CardContent } from '@/components/ui/card';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { cn } from '@/lib/utils';

type SummaryInput = {
    vehicleName?: string | null;
    vehicleMakeModel?: string | null;
    serviceName?: string | null;
    addOns: { name: string; priceCentavos: number }[];
    totalCentavos: number | null;
    /** Service plus add-on minutes. The shop's internal buffer is never part of a customer summary. */
    durationMinutes: number | null;
    startAt?: string | null;
    timezone: string;
};

type CardProps = SummaryInput & {
    heading?: string;
    description?: string;
    /** Result pages show it at every width; the wizard shows the compact form on small screens instead. */
    alwaysVisible?: boolean;
};

export type DetailRow = [label: string, value: string];

/** "Sedan · Toyota Vios": the vehicle type and, when known, its make and model. */
export function vehicleLabel(name?: string | null, makeModel?: string | null) {
    return [name, makeModel].filter(Boolean).join(' · ');
}

/**
 * A label/value description list: the same quiet row treatment on the summary
 * card, the review step and the result page. Values are right aligned on wider
 * rows and tabular so times, durations and prices line up.
 */
export function DetailRows({ rows }: { rows: readonly DetailRow[] }) {
    return (
        <dl className="grid text-sm">
            {rows.map(([label, value]) => (
                <div
                    key={label}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-2.5 first:pt-0 last:border-b-0"
                >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function summaryRows(input: SummaryInput): DetailRow[] {
    const rows: DetailRow[] = [];
    const vehicle = vehicleLabel(input.vehicleName, input.vehicleMakeModel);

    if (vehicle) {
        rows.push(['Vehicle', vehicle]);
    }
    if (input.serviceName) {
        rows.push(['Service', input.serviceName]);
    }
    if (input.addOns.length > 0) {
        rows.push([
            input.addOns.length === 1 ? 'Add-on' : 'Add-ons',
            input.addOns
                .map(
                    (addOn) =>
                        `${addOn.name} · ${formatCentavos(addOn.priceCentavos)}`,
                )
                .join(', '),
        ]);
    }
    if (input.durationMinutes !== null) {
        rows.push(['Duration', formatMinutes(input.durationMinutes)]);
    }
    if (input.startAt) {
        rows.push(['Start', formatDayAndTime(input.startAt, input.timezone)]);
    }

    return rows;
}

/**
 * Running summary of a booking beside the step content on wide screens (Spec
 * 02 references): what, how long, when and for how much. The duration is the
 * service plus add-on time the customer sees; the internal buffer, capacity,
 * units and resources never appear. Below `lg` the wizard shows
 * {@link BookingSummaryCompact} at the top of the step instead.
 */
export function BookingSummaryCard({
    heading = 'Your booking',
    description = 'A clear overview of your selections',
    alwaysVisible = false,
    ...input
}: CardProps) {
    const rows = summaryRows(input);

    return (
        <Card
            aria-labelledby="booking-summary-heading"
            className={cn(
                'rounded-2xl py-5 shadow-none',
                !alwaysVisible && 'max-lg:hidden',
            )}
        >
            <CardContent className="grid gap-3 px-5">
                <div className="grid gap-0.5">
                    <h2
                        id="booking-summary-heading"
                        className="text-lg font-semibold"
                    >
                        {heading}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Your choices appear here as you make them.
                    </p>
                ) : (
                    <DetailRows rows={rows} />
                )}
                {input.totalCentavos !== null ? (
                    <p className="flex items-baseline justify-between pt-1">
                        <span className="text-sm font-semibold">
                            Service price
                        </span>
                        <span className="text-xl font-semibold tabular-nums">
                            {formatCentavos(input.totalCentavos)}
                        </span>
                    </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                    Philippine time ({input.timezone}). Payment is handled by
                    the shop, not online.
                </p>
            </CardContent>
        </Card>
    );
}

/**
 * The same booking in two lines for narrow screens: what is being booked, and
 * when, for how long and for how much. It leads the step so the choices stay in
 * view above the fold, and is hidden from `lg` up where the card takes over.
 */
export function BookingSummaryCompact({
    pendingHint = 'Select a start time next',
    ...input
}: SummaryInput & { pendingHint?: string }) {
    const title = [
        vehicleLabel(input.vehicleName, input.vehicleMakeModel),
        [input.serviceName, ...input.addOns.map((addOn) => addOn.name)]
            .filter(Boolean)
            .join(' + '),
    ]
        .filter(Boolean)
        .join(' · ');
    const facts = [
        input.totalCentavos !== null
            ? formatCentavos(input.totalCentavos)
            : null,
        input.durationMinutes !== null
            ? formatMinutes(input.durationMinutes)
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <section
            aria-label="Your booking"
            className="grid gap-1 rounded-xl border border-primary/20 bg-primary/5 p-3 lg:hidden"
        >
            <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-primary uppercase">
                Your booking
            </p>
            <p className="text-sm font-semibold">
                {title || 'Your choices appear here as you make them.'}
            </p>
            <p className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground tabular-nums">
                <span>
                    {input.startAt
                        ? formatDayAndTime(input.startAt, input.timezone)
                        : pendingHint}
                </span>
                <span>{facts}</span>
            </p>
        </section>
    );
}
