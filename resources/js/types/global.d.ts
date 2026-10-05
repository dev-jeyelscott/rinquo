import type Echo from 'laravel-echo';
import type { RealtimeConfig } from '@/types/realtime';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            appName: string;
            displayTimezone: string;
            realtime: RealtimeConfig;
            auth: { user: { email: string } | null };
            flash: { status: string | null };
            [key: string]: unknown;
        };
    }
}

declare global {
    interface Window {
        Echo?: Echo<'reverb'>;
    }
}
