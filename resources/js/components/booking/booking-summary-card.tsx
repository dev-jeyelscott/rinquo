import { Card, CardContent } from '@/components/ui/card';
import { formatDayAndTime } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';

type Props = {
    vehicleName?: string | null;
    serviceName?: string | null;
    addOns: { name: string; priceCentavos: number }[];
    totalCentavos: number | null;
    durationMinutes: number | null;
    bufferMinutes: number | null;
    startAt?: string | null;
    timezone: string;
    heading?: string;
};

/**
 * Running summary of a booking (reference 02): what, how long, when and for how
 * much. The duration line shows the service minutes and the buffer minutes the
 * shop reserves after it; it never shows capacity, units or resources.
 */
export function BookingSummaryCard({
    vehicleName,
    serviceName,
    addOns,
    totalCentavos,
    durationMinutes,
    bufferMinutes,
    startAt,
    timezone,
    heading = 'Your booking',
}: Props) {
    const rows: [string, string][] = [];

    if (vehicleName) {
        rows.push(['Vehicle', vehicleName]);
    }
    if (serviceName) {
        rows.push(['Service', serviceName]);
    }
    if (addOns.length > 0) {
        rows.push(['Add-ons', addOns.map((addOn) => addOn.name).join(', ')]);
    }
    if (durationMinutes !== null) {
        rows.push([
            'Duration',
            bufferMinutes
                ? `${formatMinutes(durationMinutes)} service + ${formatMinutes(bufferMinutes)} buffer`
                : formatMinutes(durationMinutes),
        ]);
    }
    if (startAt) {
        rows.push(['When', formatDayAndTime(startAt, timezone)]);
    }

    return (
        <Card
            aria-labelledby="booking-summary-heading"
            className="rounded-2xl py-4 shadow-none"
        >
            <CardContent className="grid gap-3 px-4">
                <h2
                    id="booking-summary-heading"
                    className="text-lg font-semibold"
                >
                    {heading}
                </h2>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Your choices appear here as you make them.
                    </p>
                ) : (
                    <dl className="grid gap-2 text-sm">
                        {rows.map(([label, value]) => (
                            <div key={label} className="grid gap-0.5">
                                <dt className="text-muted-foreground">
                                    {label}
                                </dt>
                                <dd className="font-semibold tabular-nums">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
                {startAt ? (
                    <p className="text-xs text-muted-foreground">
                        Times are Philippine time.
                    </p>
                ) : null}
                {totalCentavos !== null ? (
                    <p className="flex items-baseline justify-between border-t pt-3">
                        <span className="text-sm text-muted-foreground">
                            Total
                        </span>
                        <span className="text-xl font-semibold tabular-nums">
                            {formatCentavos(totalCentavos)}
                        </span>
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
