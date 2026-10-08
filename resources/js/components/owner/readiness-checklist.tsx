import { Link } from '@inertiajs/react';
import { CheckCircle2Icon, CircleAlertIcon } from 'lucide-react';
import { StatusChip } from '@/components/owner/status-chip';
import { cn } from '@/lib/utils';
import type { ReadinessItem } from '@/types/owner';

type Props = {
    items: ReadinessItem[];
    /** Base path of the settings tabs; failing items link to their tab. */
    baseUrl: string;
};

/**
 * The authoritative readiness checklist, laid out like the reference rows: a
 * bordered row with the requirement and its detail on the left and a status
 * chip on the right. Pass/fail is always shown with an icon and text, never
 * color alone. Failing items link to where to fix them.
 */
export function ReadinessChecklist({ items, baseUrl }: Props) {
    return (
        <ul aria-label="Readiness checklist" className="grid gap-3">
            {items.map((item) => (
                <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-xl border bg-card p-3 max-sm:items-center max-sm:py-2"
                >
                    {item.passed ? (
                        <CheckCircle2Icon
                            aria-hidden="true"
                            className="mt-0.5 size-5 shrink-0 text-success"
                        />
                    ) : (
                        <CircleAlertIcon
                            aria-hidden="true"
                            className="mt-0.5 size-5 shrink-0 text-warning"
                        />
                    )}
                    <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="font-semibold">{item.label}</span>
                        <p
                            className={cn(
                                'text-sm text-muted-foreground',
                                item.passed && 'max-sm:sr-only',
                            )}
                        >
                            {item.detail}
                        </p>
                        {item.passed ? null : (
                            <Link
                                href={`${baseUrl}/${item.tab}`}
                                className="inline-flex min-h-8 w-fit items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                Fix in {item.tab}
                            </Link>
                        )}
                    </div>
                    <StatusChip tone={item.passed ? 'success' : 'warning'}>
                        {item.passed ? 'Passed' : 'Needs attention'}
                    </StatusChip>
                </li>
            ))}
        </ul>
    );
}
