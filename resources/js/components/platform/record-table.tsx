import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RecordColumn = {
    key: string;
    label: string;
    /** Extra classes for this column's cell, for example `md:text-right`. */
    className?: string;
};

type Props<T> = {
    /** Accessible name of the table. */
    label: string;
    columns: RecordColumn[];
    rows: T[];
    rowKey: (row: T) => string | number;
    cell: (row: T, key: string) => ReactNode;
    /** Tailwind `md:grid-cols-[...]` template for the desktop columns. */
    template: string;
};

/**
 * One semantic dataset rendered as a desktop table and as labelled records on narrow
 * viewports (Spec 08). A single DOM keeps keyboard order and controls unique: the column
 * headers name the cells: visible on desktop, visually hidden (still in the accessibility
 * tree) on mobile, where the aria-hidden per-cell label is the visible equivalent.
 */
export function RecordTable<T>({
    label,
    columns,
    rows,
    rowKey,
    cell,
    template,
}: Props<T>) {
    return (
        <div role="table" aria-label={label} className="grid text-sm">
            <div
                role="row"
                className={cn(
                    'sr-only rounded-lg bg-secondary/60 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:not-sr-only md:grid md:gap-4 md:px-3 md:py-2',
                    template,
                )}
            >
                {columns.map((column) => (
                    <div
                        key={column.key}
                        role="columnheader"
                        className={column.className}
                    >
                        {column.label}
                    </div>
                ))}
            </div>
            <div role="rowgroup" className="divide-y">
                {rows.map((row) => (
                    <div
                        key={rowKey(row)}
                        role="row"
                        className={cn(
                            'grid gap-2 px-1 py-4 md:items-center md:gap-4 md:px-3',
                            template,
                        )}
                    >
                        {columns.map((column) => (
                            <div
                                key={column.key}
                                role="cell"
                                className={cn(
                                    'flex min-w-0 flex-wrap items-center justify-between gap-2 md:block',
                                    column.className,
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className="text-xs font-medium text-muted-foreground md:hidden"
                                >
                                    {column.label}
                                </span>
                                <div className="min-w-0 [overflow-wrap:anywhere] max-md:text-right">
                                    {cell(row, column.key)}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
