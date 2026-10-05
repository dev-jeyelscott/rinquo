import { Link } from '@inertiajs/react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import type { ShopPageProps } from '@/types/shop';

type Props = {
    service: ShopPageProps['services'][number];
    /** Wizard URL that preselects this service; omitted when booking is closed. */
    selectUrl?: string;
};

/**
 * Public service card (reference 01): a thumbnail tile, the service name, a
 * "duration • vehicles" line, a "From" price and the Select action that starts
 * the booking wizard with this service preselected.
 */
export function ShopServiceCard({ service, selectUrl }: Props) {
    const durations = service.variants.map((v) => v.durationMinutes);
    const shortest = Math.min(...durations);
    const longest = Math.max(...durations);
    const meta = [
        shortest === longest
            ? formatMinutes(shortest)
            : `${formatMinutes(shortest)} - ${formatMinutes(longest)}`,
        ...service.variants.map((v) => v.vehicleType),
    ].join(' • ');

    return (
        <Card className="rounded-2xl py-4 shadow-none">
            <CardContent className="flex items-center gap-4 px-4">
                <div
                    aria-hidden="true"
                    className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold tracking-wide text-muted-foreground sm:size-[4.5rem]"
                >
                    AUTO
                </div>
                <div className="grid min-w-0 flex-1 gap-1">
                    <h3 className="text-lg leading-snug font-semibold">
                        {service.name}
                    </h3>
                    {service.description ? (
                        <p className="text-sm text-muted-foreground">
                            {service.description}
                        </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {meta}
                    </p>
                    <p className="font-semibold tabular-nums">
                        From {formatCentavos(service.fromPriceCentavos)}
                    </p>
                </div>
                {selectUrl ? (
                    <Link
                        href={selectUrl}
                        aria-label={`Select ${service.name}`}
                        className={cn(
                            buttonVariants({ variant: 'outline' }),
                            'min-h-11 shrink-0 px-5',
                        )}
                    >
                        Select
                    </Link>
                ) : null}
            </CardContent>
        </Card>
    );
}
