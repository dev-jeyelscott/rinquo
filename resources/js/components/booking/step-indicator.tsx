import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Step = { key: string; label: string };

type Props = {
    steps: readonly Step[];
    current: string;
    /** Accessible name of the progress region. */
    label?: string;
    /** `all` keeps every label visible at every width (a short, three-stage flow). */
    labels?: 'current' | 'all';
    /** Completed stages in the success tone (the reschedule flow) instead of the primary one. */
    doneTone?: 'primary' | 'success';
};

/**
 * Progress through the booking journey (Spec 02 references): numbered circles
 * joined by connector lines, completed (check mark) and current steps filled
 * with the primary token. An ordered list with the current step marked
 * aria-current="step"; completed steps say so for screen readers. All five
 * stages stay visible at every width; below `sm` only the current label shows
 * beside its circle so the row never overflows, and the position is always
 * available in words for assistive technology.
 */
export function StepIndicator({
    steps,
    current,
    label = 'Booking progress',
    labels = 'current',
    doneTone = 'primary',
}: Props) {
    const currentIndex = steps.findIndex((step) => step.key === current);

    return (
        <nav aria-label={label}>
            <p className="sr-only">
                Step {currentIndex + 1} of {steps.length}
            </p>
            <ol
                className={cn(
                    'flex items-center gap-2',
                    labels === 'all' && 'max-sm:gap-1.5',
                )}
            >
                {steps.map((step, index) => {
                    const done = index < currentIndex;
                    const active = index === currentIndex;
                    const last = index === steps.length - 1;

                    return (
                        <li
                            key={step.key}
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                                'flex items-center gap-2',
                                labels === 'all' && 'max-sm:gap-1.5',
                                !last && 'flex-1',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                                    labels === 'all' &&
                                        'max-sm:size-6 max-sm:text-xs',
                                    done && doneTone === 'success'
                                        ? 'border-success bg-success text-success-foreground'
                                        : done || active
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
                                    'text-sm font-semibold whitespace-nowrap',
                                    done && doneTone === 'success'
                                        ? 'text-success-text'
                                        : active || (done && labels === 'all')
                                          ? 'text-primary'
                                          : cn(
                                                'text-muted-foreground',
                                                labels === 'current' &&
                                                    'hidden sm:inline',
                                            ),
                                    labels === 'all' && 'text-xs sm:text-sm',
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
                            {!last ? (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'h-px min-w-1 flex-1',
                                        done
                                            ? doneTone === 'success'
                                                ? 'bg-success'
                                                : 'bg-primary'
                                            : 'bg-border',
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
