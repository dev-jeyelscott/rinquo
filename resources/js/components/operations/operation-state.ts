import type { OperationalState } from '@/types/operations';

/** The text label and tone of each operational state; the text always carries the meaning. */
export const OPERATION_STATE: Record<
    OperationalState,
    { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }
> = {
    scheduled: { label: 'Booked', tone: 'neutral' },
    checked_in: { label: 'Checked in', tone: 'info' },
    in_service: { label: 'In service', tone: 'success' },
    completed: { label: 'Completed', tone: 'neutral' },
    no_show: { label: 'No-show', tone: 'warning' },
};
