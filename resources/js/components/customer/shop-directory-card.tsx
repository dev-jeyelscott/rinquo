import { Link } from '@inertiajs/react';
import { useId } from 'react';
import { ArrowRightIcon, ClockIcon, MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCentavos } from '@/lib/money';
import type { DirectoryShop } from '@/types/customer';

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((word) => /^[\p{L}\p{N}]/u.test(word))
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();
}

/**
 * One listed shop in the neutral directory (Spec 06 refs 01 and 04): optional
 * cover and logo (initials when absent), name, city, services, starting price,
 * weekly hours, then View shop and Book. Both actions enter the existing
 * tenant-branded shop routes; the card itself carries no shop brand colour.
 */
export function ShopDirectoryCard({ shop }: { shop: DirectoryShop }) {
    const headingId = useId();

    return (
        <article
            aria-labelledby={headingId}
            className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs"
        >
            {shop.cover ? (
                <img
                    src={shop.cover.url}
                    alt=""
                    loading="lazy"
                    className="h-28 w-full object-cover sm:h-32"
                />
            ) : null}
            <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    {shop.logo ? (
                        <img
                            src={shop.logo.url}
                            alt={shop.logo.altText}
                            loading="lazy"
                            className="size-11 shrink-0 rounded-xl border object-cover"
                        />
                    ) : (
                        <span
                            aria-hidden="true"
                            className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary"
                        >
                            {initials(shop.name)}
                        </span>
                    )}
                    <div className="grid min-w-0 gap-1">
                        <h3
                            id={headingId}
                            className="text-lg leading-snug font-semibold break-words"
                        >
                            {shop.name}
                        </h3>
                        {shop.city ? (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPinIcon
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                />
                                <span className="sr-only">City: </span>
                                {shop.city}
                            </p>
                        ) : null}
                    </div>
                </div>
                <div className="grid gap-2 text-sm sm:pl-14">
                    {shop.services.length > 0 ? (
                        <p>
                            <span className="sr-only">Services: </span>
                            {shop.services.join(' · ')}
                            {shop.moreServices > 0
                                ? ` · +${shop.moreServices} more`
                                : ''}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        {shop.hours.length > 0 ? (
                            <p className="flex items-start gap-1.5 text-muted-foreground">
                                <ClockIcon
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span>
                                    <span className="sr-only">Hours: </span>
                                    {shop.hours.join('; ')}
                                </span>
                            </p>
                        ) : null}
                        {shop.fromPriceCentavos !== null ? (
                            <p className="font-semibold tabular-nums">
                                From {formatCentavos(shop.fromPriceCentavos)}
                            </p>
                        ) : null}
                    </div>
                </div>
                <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
                    <Button asChild variant="outline" className="max-sm:h-11">
                        <Link
                            href={shop.url}
                            aria-label={`View shop: ${shop.name}`}
                        >
                            View shop
                        </Link>
                    </Button>
                    <Button asChild className="max-sm:h-11">
                        <Link
                            href={shop.bookingUrl}
                            aria-label={`Book at ${shop.name}`}
                        >
                            <ArrowRightIcon aria-hidden="true" />
                            Book
                        </Link>
                    </Button>
                </div>
            </div>
        </article>
    );
}
