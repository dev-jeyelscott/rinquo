import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'warning' | 'success' | 'neutral';

const VALUE_TONES: Record<Tone, string> = {
    info: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    neutral: 'text-foreground',
};

type Props = {
    label: string;
    value: number;
    tone?: Tone;
    /** One short supporting phrase, for example "3 not arrived". */
    hint?: string;
    /** Smaller figure and padding, and no hint below the sm breakpoint, so a set of counters fits one row on a phone. */
    compact?: boolean;
};

/**
 * One operations counter from the staff dashboard reference: a muted label over
 * a large tabular figure. The number is the meaning; the tone only reinforces
 * the label, so nothing relies on colour alone.
 */
export function OperationStatCard({
    label,
    value,
    tone = 'neutral',
    hint,
    compact = false,
}: Props) {
    return (
        <Card
            className={cn(
                'rounded-2xl py-4 shadow-none',
                compact && 'max-sm:py-3',
            )}
        >
            <CardContent
                className={cn('grid gap-1 px-5', compact && 'max-sm:px-3')}
            >
                <p className="text-sm font-semibold text-muted-foreground">
                    {label}
                </p>
                <p
                    className={cn(
                        'text-3xl font-bold tabular-nums',
                        compact && 'max-sm:text-2xl',
                        VALUE_TONES[tone],
                    )}
                >
                    {value}
                </p>
                {hint ? (
                    <p
                        className={cn(
                            'text-xs text-muted-foreground',
                            compact && 'max-sm:hidden',
                        )}
                    >
                        {hint}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
