import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Step = { key: string; label: string };

type Props = { steps: readonly Step[]; current: string };

/**
 * Progress through the booking journey (reference 02): numbered circles joined
 * by lines, completed and current steps filled with the primary token. An
 * ordered list with the current step marked aria-current="step"; completed
 * steps say so for screen readers. On narrow screens only the current label is
 * shown beside a "Step n of N" count, so five steps never overflow.
 */
export function StepIndicator({ steps, current }: Props) {
    const currentIndex = steps.findIndex((step) => step.key === current);

    return (
        <nav aria-label="Booking progress">
            <p className="mb-2 text-sm font-medium text-muted-foreground tabular-nums sm:hidden">
                Step {currentIndex + 1} of {steps.length}
            </p>
            <ol className="flex items-center gap-2">
                {steps.map((step, index) => {
                    const done = index < currentIndex;
                    const active = index === currentIndex;

                    return (
                        <li
                            key={step.key}
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                                'flex items-center gap-2',
                                index < steps.length - 1 && 'sm:flex-1',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                                    done || active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground',
                                )}
                            >
                                {done ? (
                                    <CheckIcon className="size-4" />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <span
                                className={cn(
                                    'text-sm whitespace-nowrap',
                                    active
                                        ? 'font-semibold'
                                        : 'hidden text-muted-foreground sm:inline',
                                )}
                            >
                                {step.label}
                                {done ? (
                                    <span className="sr-only">
                                        {' '}
                                        (completed)
                                    </span>
                                ) : null}
                            </span>
                            {index < steps.length - 1 ? (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'hidden h-px flex-1 sm:block',
                                        done ? 'bg-primary' : 'bg-border',
                                    )}
                                />
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export const BOOKING_STEPS: readonly Step[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'service', label: 'Service' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'details', label: 'Details' },
    { key: 'confirm', label: 'Confirm' },
];
