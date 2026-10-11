import { Card, CardContent } from '@/components/ui/card';
import type { CapacityRowData } from '@/types/operations';

/**
 * Resource load right now (Spec 04 references 01 and 14). Text carries the
 * meaning ("2 / 2 full", "Blocked"); colour only reinforces it. The load comes
 * from the same claim reader that availability and assignment use.
 */
export function CapacityPanel({ rows }: { rows: CapacityRowData[] }) {
    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-4 px-5">
                <h2 className="text-xl font-semibold">Capacity now</h2>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No active resources. Add one in Settings.
                    </p>
                ) : (
                    <ul aria-label="Capacity now" className="grid gap-3">
                        {rows.map((row) => {
                            const full =
                                row.blocked || row.used >= row.capacity;

                            return (
                                <li key={row.id} className="grid gap-1">
                                    <p className="flex items-baseline justify-between gap-2 font-semibold">
                                        <span>{row.name}</span>
                                        <span
                                            className={
                                                full
                                                    ? 'text-destructive tabular-nums'
                                                    : 'text-success tabular-nums'
                                            }
                                        >
                                            {row.blocked
                                                ? 'Blocked'
                                                : `${row.used} / ${row.capacity}${full ? ' full' : ''}`}
                                        </span>
                                    </p>
                                    <div
                                        aria-hidden="true"
                                        className="h-2 overflow-hidden rounded-full bg-secondary"
                                    >
                                        <div
                                            className={
                                                full
                                                    ? 'h-full bg-destructive'
                                                    : 'h-full bg-success'
                                            }
                                            style={{
                                                width: `${row.blocked ? 100 : Math.min(100, (row.used / row.capacity) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                    {full ? (
                                        <p className="text-xs text-muted-foreground">
                                            No free capacity right now.
                                        </p>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
