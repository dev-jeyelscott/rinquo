import { CheckCircle2Icon, CircleAlertIcon, InfoIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { BillingView } from '@/lib/billing-view';
import { ALERT_TONES } from '@/lib/tones';

const ICONS = {
    info: InfoIcon,
    success: CheckCircle2Icon,
    warning: CircleAlertIcon,
    error: CircleAlertIcon,
} as const;

/** The page-level state banner for the non-access scenes (trial, paid, renewal-request states). */
export function BillingBanner({
    banner,
}: {
    banner: NonNullable<BillingView['banner']>;
}) {
    const Icon = ICONS[banner.tone];

    return (
        <Alert className={ALERT_TONES[banner.tone]} role="status">
            <Icon aria-hidden="true" />
            <AlertTitle className="text-base font-semibold">
                {banner.title}
            </AlertTitle>
            <AlertDescription>
                <p className="max-w-[65ch]">{banner.body}</p>
            </AlertDescription>
        </Alert>
    );
}
