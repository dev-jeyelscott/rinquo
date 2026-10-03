import { createInertiaApp } from '@inertiajs/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from '@/layouts/app-shell';

void createInertiaApp({
    title: (title) => {
        const appName =
            document.querySelector<HTMLMetaElement>(
                'meta[name="application-name"]',
            )?.content ?? 'Rinquo';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: () => AppShell,
    strictMode: true,
    withApp(app) {
        return <TooltipProvider delayDuration={0}>{app}</TooltipProvider>;
    },
    progress: {
        color: '#4B5563',
    },
});
