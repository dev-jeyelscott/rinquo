import type Echo from 'laravel-echo';
import type { ScheduleImpact } from '@/types/conflicts';
import type { PlatformShared } from '@/types/platform';
import type { RealtimeConfig } from '@/types/realtime';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            appName: string;
            displayTimezone: string;
            realtime: RealtimeConfig;
            auth: { user: { email: string } | null };
            /** Present only on /platform pages. */
            platform?: PlatformShared | null;
            flash: {
                status: string | null;
                /** One-request review of a scheduling change that would disrupt future bookings. */
                schedulingImpact?: ScheduleImpact | null;
            };
            [key: string]: unknown;
        };
    }
}

declare global {
    interface Window {
        Echo?: Echo<'reverb'>;
    }
}
