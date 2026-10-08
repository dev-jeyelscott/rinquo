import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RecordColumn<Row> = {
    key: string;
    header: string;
    cell: (row: Row) => ReactNode;
    /** Placement of the cell in the stacked small-screen row; prefix classes with `max-md:`. */
    mobileClassName?: string;
    /** Visually hide the header (action columns); it stays available to assistive tech. */
    srOnlyHeader?: boolean;
};

type Props<Row> = {
    /** Accessible name of the table. */
    label: string;
    columns: RecordColumn<Row>[];
    rows: Row[];
    rowKey: (row: Row) => string | number;
    /** Tailwind `md:grid-cols-[...]` template shared by the header and rows. */
    gridClassName: string;
    emptyMessage?: ReactNode;
    className?: string;
};

/**
 * A columnar record list (Resources, service variants) exposed as an ARIA table
 * (explicit roles, because the responsive layout is not a native table). From md up it reads as
 * a table with a header row; below md each row stacks into a card-like block
 * (first columns on top, the rest beneath) and the header row is visually
 * hidden but still exposed. Cells are presentation only.
 */
export function RecordTable<Row>({
    label,
    columns,
    rows,
    rowKey,
    gridClassName,
    emptyMessage,
    className,
}: Props<Row>) {
    return (
        <div className={className}>
            {rows.length === 0 && emptyMessage ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : null}
            {rows.length === 0 ? null : (
                <div role="table" aria-label={label} className="grid">
                    <div
                        role="row"
                        className={cn(
                            'max-md:sr-only md:grid md:gap-3',
                            gridClassName,
                        )}
                    >
                        {columns.map((column) => (
                            <div
                                key={column.key}
                                role="columnheader"
                                className="py-2 text-left text-xs font-semibold text-muted-foreground"
                            >
                                {column.srOnlyHeader ? (
                                    <span className="sr-only">
                                        {column.header}
                                    </span>
                                ) : (
                                    column.header
                                )}
                            </div>
                        ))}
                    </div>
                    {rows.map((row) => (
                        <div
                            key={rowKey(row)}
                            role="row"
                            className={cn(
                                'grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t py-3 max-md:mb-2 max-md:rounded-xl max-md:border max-md:p-3 md:gap-3',
                                gridClassName,
                            )}
                        >
                            {columns.map((column) => (
                                <div
                                    key={column.key}
                                    role="cell"
                                    className={cn(
                                        'min-w-0 text-sm',
                                        column.mobileClassName,
                                    )}
                                >
                                    {column.cell(row)}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
