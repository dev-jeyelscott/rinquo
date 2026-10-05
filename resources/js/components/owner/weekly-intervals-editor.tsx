import { PlusIcon, Trash2Icon } from 'lucide-react';
import { SelectField, TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import { WEEKDAYS } from '@/lib/schedule';
import type { Interval } from '@/types/owner';

type Props = {
    /** Visible name of what is edited, used in labels ("Opening hours"). */
    name: string;
    value: Interval[];
    onChange: (next: Interval[]) => void;
    errors?: Record<string, string | undefined>;
    /** Prefix of the server error keys, e.g. "weekly" or "windows". */
    errorPrefix: string;
    startKey: string;
    endKey: string;
    emptyMessage: string;
};

/**
 * Edits weekly local-time intervals (weekday, start, end). Several intervals
 * per day are allowed; the server rejects overlaps and reversed ranges.
 */
export function WeeklyIntervalsEditor({
    name,
    value,
    onChange,
    errors = {},
    errorPrefix,
    startKey,
    endKey,
    emptyMessage,
}: Props) {
    const update = (index: number, patch: Partial<Interval>) =>
        onChange(
            value.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );

    return (
        <div className="grid gap-3">
            {errors[errorPrefix] ? (
                <p role="alert" className="text-sm text-destructive">
                    {errors[errorPrefix]}
                </p>
            ) : null}
            {value.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : null}
            <ul className="grid gap-3">
                {value.map((interval, index) => {
                    const day =
                        WEEKDAYS.find((d) => d.value === interval.weekday)
                            ?.label ?? '';

                    return (
                        <li
                            key={index}
                            className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                        >
                            <SelectField
                                label={`${name}: day ${index + 1}`}
                                value={String(interval.weekday)}
                                options={WEEKDAYS.map((d) => ({
                                    value: String(d.value),
                                    label: d.label,
                                }))}
                                onChange={(event) =>
                                    update(index, {
                                        weekday: Number(event.target.value),
                                    })
                                }
                                error={
                                    errors[`${errorPrefix}.${index}.weekday`]
                                }
                            />
                            <TextField
                                label={`${day} starts`}
                                type="time"
                                value={interval.start}
                                onChange={(event) =>
                                    update(index, { start: event.target.value })
                                }
                                error={
                                    errors[
                                        `${errorPrefix}.${index}.${startKey}`
                                    ]
                                }
                            />
                            <TextField
                                label={`${day} ends`}
                                type="time"
                                value={interval.end}
                                onChange={(event) =>
                                    update(index, { end: event.target.value })
                                }
                                error={
                                    errors[`${errorPrefix}.${index}.${endKey}`]
                                }
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="max-sm:size-11"
                                aria-label={`Remove ${day} interval ${index + 1}`}
                                onClick={() =>
                                    onChange(
                                        value.filter((_, i) => i !== index),
                                    )
                                }
                            >
                                <Trash2Icon aria-hidden="true" />
                            </Button>
                        </li>
                    );
                })}
            </ul>
            <div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                        onChange([
                            ...value,
                            { weekday: 1, start: '09:00', end: '17:00' },
                        ])
                    }
                >
                    <PlusIcon aria-hidden="true" />
                    Add interval
                </Button>
            </div>
        </div>
    );
}
