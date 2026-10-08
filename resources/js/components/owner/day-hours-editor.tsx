import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatClockTime, WEEKDAYS } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import type { Interval } from '@/types/owner';

type Props = {
    /** Visible name of what is edited, used for the group label ("Opening hours"). */
    name: string;
    value: Interval[];
    onChange: (next: Interval[]) => void;
    errors?: Record<string, string | undefined>;
    /** Prefix of the server error keys, for example "weekly". */
    errorPrefix: string;
    startKey: string;
    endKey: string;
    emptyMessage: string;
};

const DEFAULT_INTERVAL = { start: '09:00', end: '17:00' };

/**
 * Weekly hours grouped by day (Approved Owner Settings Hours): each of the
 * seven days has an Open/Closed switch and its own intervals with a per-day
 * "+ interval". The value stays the flat list of intervals the server expects,
 * so server error keys (`weekly.<index>.<field>`) still address the right row.
 * Desktop shows Day / Status / Intervals as a table-like list. Below md each day
 * is a compact row with its summary and switch; selecting the summary reveals
 * that day's intervals for editing.
 */
export function DayHoursEditor({
    name,
    value,
    onChange,
    errors = {},
    errorPrefix,
    startKey,
    endKey,
    emptyMessage,
}: Props) {
    const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
    const idBase = useId();

    const update = (index: number, patch: Partial<Interval>) =>
        onChange(
            value.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );

    const toggleExpanded = (weekday: number) =>
        setExpanded((current) => {
            const next = new Set(current);

            if (!next.delete(weekday)) {
                next.add(weekday);
            }

            return next;
        });

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
            <div
                className="hidden grid-cols-[7rem_9rem_1fr] gap-3 border-b pb-2 text-xs font-semibold text-muted-foreground md:grid"
                aria-hidden="true"
            >
                <span>Day</span>
                <span>Status</span>
                <span>Intervals</span>
            </div>
            <ul aria-label={name} className="grid">
                {WEEKDAYS.map((day) => {
                    const rows = value
                        .map((interval, index) => ({ interval, index }))
                        .filter((row) => row.interval.weekday === day.value);
                    const open = rows.length > 0;
                    const hasError = rows.some(
                        (row) =>
                            errors[`${errorPrefix}.${row.index}.${startKey}`] ||
                            errors[`${errorPrefix}.${row.index}.${endKey}`] ||
                            errors[`${errorPrefix}.${row.index}.weekday`],
                    );
                    const showEditor = expanded.has(day.value) || hasError;
                    const editorId = `${idBase}-${day.value}`;
                    const summary = open
                        ? rows
                              .map(
                                  (row) =>
                                      `${formatClockTime(row.interval.start)} – ${formatClockTime(row.interval.end)}`,
                              )
                              .join(', ')
                        : 'Closed';

                    return (
                        <li
                            key={day.value}
                            className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-x-3 gap-y-2 border-t py-1.5 first:border-t-0 md:grid-cols-[7rem_9rem_1fr] md:items-start md:py-3"
                        >
                            <span className="text-sm font-semibold md:pt-2.5">
                                {day.label}
                            </span>
                            {open ? (
                                <button
                                    type="button"
                                    aria-expanded={showEditor}
                                    aria-controls={editorId}
                                    aria-label={`${day.label} intervals: ${summary}`}
                                    onClick={() => toggleExpanded(day.value)}
                                    className="min-h-11 rounded-md px-1 text-left text-sm text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:hidden"
                                >
                                    {summary}
                                </button>
                            ) : (
                                <span className="text-sm text-muted-foreground md:hidden">
                                    Closed
                                </span>
                            )}
                            <label className="flex min-h-11 cursor-pointer items-center gap-2 max-md:justify-self-end md:col-start-2 md:row-start-1">
                                <input
                                    type="checkbox"
                                    role="switch"
                                    className="peer sr-only"
                                    checked={open}
                                    aria-label={`${day.label} open`}
                                    onChange={(event) =>
                                        onChange(
                                            event.target.checked
                                                ? [
                                                      ...value,
                                                      {
                                                          weekday: day.value,
                                                          ...DEFAULT_INTERVAL,
                                                      },
                                                  ]
                                                : value.filter(
                                                      (item) =>
                                                          item.weekday !==
                                                          day.value,
                                                  ),
                                        )
                                    }
                                />
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'relative h-6 w-10 shrink-0 rounded-full bg-muted-foreground transition-colors peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none',
                                    )}
                                />
                                <span
                                    aria-hidden="true"
                                    className="hidden text-sm md:inline"
                                >
                                    {open ? 'Open' : 'Closed'}
                                </span>
                            </label>
                            <div
                                id={editorId}
                                className={cn(
                                    'col-span-3 gap-2 md:col-span-1 md:col-start-3 md:row-start-1 md:grid',
                                    showEditor ? 'grid' : 'hidden',
                                )}
                            >
                                {open ? (
                                    <ul
                                        aria-label={`${day.label} intervals`}
                                        className="grid gap-2"
                                    >
                                        {rows.map((row, position) => {
                                            const prefix = `${errorPrefix}.${row.index}`;
                                            const label =
                                                position === 0
                                                    ? day.label
                                                    : `${day.label} interval ${position + 1}`;
                                            const startError =
                                                errors[`${prefix}.${startKey}`];
                                            const endError =
                                                errors[`${prefix}.${endKey}`];
                                            const rowError =
                                                errors[`${prefix}.weekday`];

                                            return (
                                                <li
                                                    key={row.index}
                                                    className="grid gap-1"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Input
                                                            type="time"
                                                            aria-label={`${label} starts`}
                                                            aria-invalid={
                                                                startError
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            className="h-11 w-32 md:h-9"
                                                            value={
                                                                row.interval
                                                                    .start
                                                            }
                                                            onChange={(event) =>
                                                                update(
                                                                    row.index,
                                                                    {
                                                                        start: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                        <span aria-hidden="true">
                                                            –
                                                        </span>
                                                        <Input
                                                            type="time"
                                                            aria-label={`${label} ends`}
                                                            aria-invalid={
                                                                endError
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            className="h-11 w-32 md:h-9"
                                                            value={
                                                                row.interval.end
                                                            }
                                                            onChange={(event) =>
                                                                update(
                                                                    row.index,
                                                                    {
                                                                        end: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="max-sm:size-11"
                                                            aria-label={`Remove ${day.label} interval ${position + 1}`}
                                                            onClick={() =>
                                                                onChange(
                                                                    value.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            row.index,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            <Trash2Icon aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                    {[
                                                        startError,
                                                        endError,
                                                        rowError,
                                                    ]
                                                        .filter(Boolean)
                                                        .map((message) => (
                                                            <p
                                                                key={message}
                                                                className="text-sm text-destructive"
                                                            >
                                                                {message}
                                                            </p>
                                                        ))}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="hidden text-sm text-muted-foreground md:block md:pt-2.5">
                                        Closed. No intervals.
                                    </p>
                                )}
                                {open ? (
                                    <div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="max-sm:h-11"
                                            aria-label={`Add ${day.label} interval`}
                                            onClick={() =>
                                                onChange([
                                                    ...value,
                                                    {
                                                        weekday: day.value,
                                                        ...DEFAULT_INTERVAL,
                                                    },
                                                ])
                                            }
                                        >
                                            <PlusIcon aria-hidden="true" />
                                            interval
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
