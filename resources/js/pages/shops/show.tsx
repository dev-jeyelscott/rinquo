import { Head, Link } from '@inertiajs/react';
import { ShopServiceCard } from '@/components/shop/shop-service-card';
import { Card, CardContent } from '@/components/ui/card';
import type { ShopPageProps } from '@/types/shop';

/**
 * Public storefront (reference 01). The hero leads with the tenant's own
 * outcome statement and one primary "Book now" action into the wizard. The
 * reference's home-page "Next available" is omitted: it depends on the vehicle
 * and service, so it lives on the wizard's Schedule step. A shop that cannot
 * take online bookings says so instead of offering a dead control.
 */
export default function Show({
    shop,
    branch,
    hours,
    services,
    bookingAvailable,
    bookingUrl,
}: ShopPageProps) {
    return (
        <>
            <Head title={shop.name} />
            <div className="grid gap-6">
                <section
                    aria-labelledby="shop-heading"
                    className="grid gap-6 rounded-3xl bg-[var(--tenant-brand)] p-6 text-[var(--tenant-brand-foreground)] sm:grid-cols-[3fr_2fr] sm:p-9"
                >
                    <div className="grid content-between gap-6">
                        <div className="grid gap-3">
                            <p className="w-fit rounded-full bg-[var(--tenant-brand-foreground)]/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                                {branch.city}
                            </p>
                            <h1
                                id="shop-heading"
                                className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
                            >
                                {shop.tagline}
                            </h1>
                            <p className="max-w-[60ch] text-base opacity-90">
                                {shop.description}
                            </p>
                        </div>
                        {bookingAvailable ? (
                            <div>
                                <Link
                                    href={bookingUrl}
                                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--tenant-brand-foreground)] px-6 text-base font-semibold text-[var(--tenant-brand)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--tenant-brand-foreground)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tenant-brand)]"
                                >
                                    Book now
                                </Link>
                            </div>
                        ) : (
                            <div role="status" className="grid gap-0.5">
                                <p className="text-lg font-semibold">
                                    Online booking unavailable
                                </p>
                                <p className="text-sm opacity-90">
                                    You can browse services and prices. Online
                                    booking is not open yet.
                                </p>
                            </div>
                        )}
                    </div>
                    {shop.hero ? (
                        <img
                            src={shop.hero.url}
                            alt={shop.hero.altText}
                            className="h-48 w-full rounded-2xl object-cover sm:h-full sm:min-h-56"
                        />
                    ) : (
                        <div
                            aria-hidden="true"
                            className="hidden items-center justify-center rounded-2xl bg-[var(--tenant-brand-foreground)]/10 text-7xl font-semibold sm:flex"
                        >
                            {shop.name.slice(0, 1)}
                        </div>
                    )}
                </section>

                <div className="grid gap-4 min-[30rem]:grid-cols-2">
                    <Card className="rounded-2xl py-4 shadow-none">
                        <CardContent className="grid gap-1 px-4">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Today&apos;s hours
                            </h2>
                            <p className="text-xl font-semibold tabular-nums">
                                {hours.today}
                            </p>
                            <details className="text-sm">
                                <summary className="cursor-pointer text-primary">
                                    Weekly hours
                                </summary>
                                <ul className="mt-2 grid gap-1 tabular-nums">
                                    {hours.weekly.map((day) => (
                                        <li
                                            key={day.day}
                                            className="flex justify-between gap-4"
                                        >
                                            <span>{day.day}</span>
                                            <span>{day.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl py-4 shadow-none">
                        <CardContent className="grid gap-1 px-4">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Location
                            </h2>
                            <p className="text-xl font-semibold">
                                {branch.city}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {branch.addressLine}
                            </p>
                            {branch.phone ? (
                                <p className="text-sm">
                                    <a
                                        href={`tel:${branch.phone.replace(/[^+\d]/g, '')}`}
                                        className="text-primary underline underline-offset-4"
                                    >
                                        {branch.phone}
                                    </a>
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                <section
                    aria-labelledby="services-heading"
                    className="grid gap-3"
                >
                    <h2
                        id="services-heading"
                        className="text-2xl font-semibold tracking-tight"
                    >
                        Services
                    </h2>
                    {services.map((service) => (
                        <ShopServiceCard
                            key={service.id}
                            service={service}
                            selectUrl={
                                bookingAvailable
                                    ? `${bookingUrl}?service=${service.id}`
                                    : undefined
                            }
                        />
                    ))}
                </section>
            </div>
        </>
    );
}
