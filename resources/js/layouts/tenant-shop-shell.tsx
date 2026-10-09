import { usePage } from '@inertiajs/react';
import type { CSSProperties, ReactNode } from 'react';
import { StatusChip } from '@/components/owner/status-chip';
import { readableForeground } from '@/lib/color';
import type { ShopPageProps } from '@/types/shop';

/**
 * Tenant-branded public shell (reference screen 01 and the Spec 02 booking
 * references): the Rinquo wordmark with the shop name beneath it, the city and
 * the open or closed chip at the right, and a quiet
 * page background so white cards read as surfaces. The tenant's brand color is
 * data, exposed as one CSS variable; everything else uses design tokens.
 * Unavailable pages carry no tenant data and render the neutral shell.
 */
export default function TenantShopShell({ children }: { children: ReactNode }) {
    const { props } = usePage<Partial<ShopPageProps>>();
    const shop = props.shop;
    const brand = shop?.brandColor;

    const style = brand
        ? ({
              '--tenant-brand': brand,
              '--tenant-brand-foreground': readableForeground(brand),
          } as CSSProperties)
        : undefined;

    return (
        <div
            style={style}
            className="flex min-h-screen flex-col bg-secondary/60 text-foreground"
        >
            <header className="border-b bg-background">
                <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        {shop?.logo ? (
                            <img
                                src={shop.logo.url}
                                alt={shop.logo.altText}
                                className="size-10 shrink-0 rounded-lg object-cover"
                            />
                        ) : null}
                        <div className="min-w-0">
                            <p className="text-xl leading-tight font-semibold tracking-tight">
                                {props.appName}
                            </p>
                            {shop ? (
                                <p className="truncate text-sm font-medium text-muted-foreground">
                                    {shop.name}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        {props.branch?.city ? (
                            <p className="hidden text-sm text-muted-foreground sm:block">
                                {props.branch.city}
                            </p>
                        ) : null}
                        {props.hours ? (
                            <StatusChip
                                caps
                                tone={
                                    props.hours.openNow ? 'success' : 'neutral'
                                }
                            >
                                {props.hours.openNow
                                    ? 'Open now'
                                    : 'Closed now'}
                            </StatusChip>
                        ) : null}
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
                {children}
            </main>
        </div>
    );
}
