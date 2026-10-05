import { createInertiaApp } from '@inertiajs/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from '@/layouts/app-shell';
import OwnerShell from '@/layouts/owner-shell';
import TenantShopShell from '@/layouts/tenant-shop-shell';

void createInertiaApp({
    title: (title) => {
        const appName =
            document.querySelector<HTMLMetaElement>(
                'meta[name="application-name"]',
            )?.content ?? 'Rinquo';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: (name) => {
        if (name.startsWith('owner/settings/')) {
            return OwnerShell;
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
