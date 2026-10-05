import { formatDayAndTime } from '@/lib/booking-format';
import { cn } from '@/lib/utils';
import type { CandidateTime } from '@/types/conflicts';

type Props = {
    times: CandidateTime[];
    value: string;
    onChange: (startAt: string) => void;
    timezone: string;
    legend: string;
};

/**
 * Currently available replacement times as one radio group (native inputs, so
 * arrow keys and screen readers work). Availability is the server's answer
 * right now; the server checks it again when the proposal is sent.
 */
export function CandidateTimes({
    times,
    value,
    onChange,
    timezone,
    legend,
}: Props) {
    return (
        <fieldset className="grid gap-2">
            <legend className="mb-1 font-semibold">{legend}</legend>
            {times.map((time) => {
                const selected = value === time.startAt;

                return (
                    <label
                        key={time.startAt}
                        className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 max-sm:min-h-11',
                            selected
                                ? 'border-primary bg-info/10'
                                : 'bg-card hover:bg-accent',
                        )}
                    >
                        <input
                            type="radio"
                            name="proposed-time"
                            value={time.startAt}
                            checked={selected}
                            onChange={() => onChange(time.startAt)}
                            className="size-4 accent-primary"
                        />
                        <span className="grid">
                            <span className="font-semibold tabular-nums">
                                {formatDayAndTime(time.startAt, timezone)}
                            </span>
                            <span className="text-muted-foreground">
                                {time.resource} · available
                            </span>
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
}
