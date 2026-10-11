import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { BlockResourceSheet } from '@/components/operations/block-resource-sheet';
import { useOperationsLocked } from '@/components/operations/operations-lock';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDayAndTime } from '@/lib/booking-format';
import type { BlockRowData, ResourceOption } from '@/types/operations';

type Props = {
    blocks: BlockRowData[];
    /** Whole-result count of active blocks (the list itself is paged). */
    total: number;
    url: string;
    resources: ResourceOption[];
    timezone: string;
};

/**
 * Active resource blocks with a visible release action and the form to add one
 * (Spec 04 references 12 and 13). Releasing a block only frees the resource:
 * reservations are never silently adjusted. Disabled while offline.
 */
export function BlocksPanel({
    blocks,
    total,
    url,
    resources,
    timezone,
}: Props) {
    const locked = useOperationsLocked();
    const [releasing, setReleasing] = useState<string | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);

    return (
        <Card className="rounded-2xl py-5 shadow-none">
            <CardContent className="grid gap-3 px-5">
                <h2
                    ref={heading}
                    tabIndex={-1}
                    className="text-xl font-semibold outline-none"
                >
                    Blocked resources
                </h2>
                {total === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing is blocked.
                    </p>
                ) : (
                    <ul aria-label="Blocked resources" className="grid gap-2">
                        {blocks.map((block) => (
                            <li key={block.id} className="grid gap-1 text-sm">
                                <p className="font-semibold">
                                    {block.resourceName}
                                </p>
                                <p className="tabular-nums">
                                    {formatDayAndTime(block.startsAt, timezone)}{' '}
                                    to{' '}
                                    {formatDayAndTime(block.endsAt, timezone)}
                                </p>
                                <p className="text-muted-foreground">
                                    {block.reason}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-fit max-sm:h-11"
                                    aria-label={`Release block on ${block.resourceName}`}
                                    disabled={locked || releasing === block.id}
                                    aria-busy={releasing === block.id}
                                    onClick={() =>
                                        router.post(
                                            `${url}/${block.id}/release`,
                                            {},
                                            {
                                                preserveScroll: true,
                                                onStart: () =>
                                                    setReleasing(block.id),
                                                // The released block leaves the list, so focus moves to the section heading.
                                                onFinish: () => {
                                                    setReleasing(null);
                                                    heading.current?.focus();
                                                },
                                            },
                                        )
                                    }
                                >
                                    {releasing === block.id
                                        ? 'Releasing…'
                                        : 'Release block'}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                <BlockResourceSheet
                    url={url}
                    resources={resources}
                    timezone={timezone}
                />
            </CardContent>
        </Card>
    );
}
