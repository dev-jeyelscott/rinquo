import { Link } from '@inertiajs/react';
import { EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { SupportBannerData } from '@/types/platform';

/**
 * Persistent, non-dismissible banner for every page of a support session. It states that the
 * view is read-only, names the organization and the member whose permissions apply, shows
 * the time left, and always offers the exit. Meaning is carried by text, not colour.
 */
export function SupportBanner({ support }: { support: SupportBannerData }) {
    const now = useNow(1000);
    const secondsLeft = Math.max(
        0,
        Math.floor((new Date(support.expiresAt).getTime() - now) / 1000),
    );
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');

    return (
        <section
            aria-label="Support session"
            className={cn(
                'sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm sm:px-6',
                ALERT_TONES.warning,
            )}
        >
            <p className="flex min-w-0 flex-wrap items-center gap-x-2">
                <EyeIcon className="size-4" aria-hidden="true" />
                <strong>Read-only support view</strong>
                <span>
                    {support.organizationName} as {support.targetRole}{' '}
                    {support.targetEmail}. Reference {support.reference}.
                </span>
                <span className="tabular-nums" role="timer">
                    {secondsLeft === 0
                        ? 'Session ended'
                        : `${minutes}:${seconds} left`}
                </span>
            </p>
            <Button asChild variant="outline" size="sm" className="max-sm:h-11">
                <Link href={support.exitUrl} method="post" as="button">
                    Exit support session
                </Link>
            </Button>
        </section>
    );
}
