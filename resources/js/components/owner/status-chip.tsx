import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'neutral';

const TONES: Record<Tone, string> = {
    info: 'bg-info/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    neutral: 'bg-secondary text-secondary-foreground',
};

type Props = Omit<ComponentProps<typeof Badge>, 'variant'> & {
    tone?: Tone;
    /** Small all-caps label such as OWNER ONLY or OPEN NOW. */
    caps?: boolean;
};

/**
 * Pill-shaped status chip from the reference screens (OWNER ONLY, OPEN NOW,
 * "1 unit"). Meaning always comes from the text; the tone only reinforces it.
 */
export function StatusChip({
    tone = 'neutral',
    caps = false,
    className,
    ...props
}: Props) {
    return (
        <Badge
            variant="secondary"
            className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold tabular-nums',
                caps && 'tracking-wide uppercase',
                TONES[tone],
                className,
            )}
            {...props}
        />
    );
}
