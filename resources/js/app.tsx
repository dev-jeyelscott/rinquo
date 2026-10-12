import { createInertiaApp, router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from '@/layouts/app-shell';
import OwnerShell from '@/layouts/owner-shell';
import PlatformShell from '@/layouts/platform-shell';
import TenantShopShell from '@/layouts/tenant-shop-shell';
import { setTelemetryRoute, startTelemetry } from '@/lib/telemetry';

/** Customer account pages render their own neutral CustomerShell (or the sign-in frame). */
function OwnShell({ children }: { children: ReactNode }) {
    return children;
}

void startTelemetry();
router.on('navigate', (event) =>
    setTelemetryRoute(event.detail.page.component),
);

void createInertiaApp({
    title: (title) => {
        const appName =
            document.querySelector<HTMLMetaElement>(
                'meta[name="application-name"]',
            )?.content ?? 'Rinquo';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: (name) => {
        if (name.startsWith('platform/')) {
            return PlatformShell;
        }

        if (
            name.startsWith('owner/settings/') ||
            name === 'owner/booking-requests' ||
            name === 'owner/operations' ||
            name === 'owner/scheduling-conflicts'
        ) {
            return OwnerShell;
        }

        if (name.startsWith('customer/')) {
            return OwnShell;
        }

        return name.startsWith('shops/') ? TenantShopShell : AppShell;
    },
    strictMode: true,
    withApp(app) {
        return <TooltipProvider delayDuration={0}>{app}</TooltipProvider>;
    },
    progress: {
        color: '#4B5563',
    },
});
