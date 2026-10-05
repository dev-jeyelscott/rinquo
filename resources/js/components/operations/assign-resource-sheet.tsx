import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { SelectField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { uuid } from '@/lib/booking-format';
import type { QueueRowData, ResourceOption } from '@/types/operations';

type Props = {
    row: QueueRowData;
    url: string;
    resources: ResourceOption[];
};

/**
 * Contextual form (bottom sheet on phones, side drawer on larger screens) to
 * move a queued booking to another resource of the booked type. Only the
 * compatible, in-use resources are offered, but the server re-validates blocks,
 * capacity and tenant ownership and answers with a specific reason.
 */
export function AssignResourceSheet({ row, url, resources }: Props) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [resourceId, setResourceId] = useState(String(row.resource.id));
    const { props } = usePage<{ errors?: Record<string, string> }>();
    const error = props.errors?.resource_id ?? props.errors?.booking;
    const options = resources
        .filter((resource) => row.compatibleResourceIds.includes(resource.id))
        .map((resource) => ({
            value: String(resource.id),
            label:
                resource.id === row.resource.id
                    ? `${resource.name} (current)`
                    : resource.name,
        }));

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post(
            url,
            {
                revision: row.revision,
                idempotency_key: uuid(),
                resource_id: Number(resourceId),
            },
            {
                preserveScroll: true,
                onStart: () => setPending(true),
                onFinish: () => setPending(false),
                onSuccess: () => setOpen(false),
            },
        );
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    aria-label={`Assign resource for ${row.customerName}`}
                >
                    Assign resource
                </Button>
            </SheetTrigger>
            <SheetContent className="max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[92%] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 sm:w-[40vw] sm:max-w-md sm:min-w-80">
                <form onSubmit={submit} className="grid gap-4 p-4" noValidate>
                    <SheetHeader className="p-0">
                        <SheetTitle>
                            Assign a resource for {row.customerName}
                        </SheetTitle>
                        <SheetDescription>
                            The appointment time does not change. Currently on{' '}
                            {row.resource.name}.
                        </SheetDescription>
                    </SheetHeader>
                    {options.length > 1 ? (
                        <SelectField
                            label="Resource"
                            value={resourceId}
                            onChange={(event) =>
                                setResourceId(event.target.value)
                            }
                            options={options}
                            error={error}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No other active resource of this booking&apos;s type
                            can take it.
                        </p>
                    )}
                    <Button
                        type="submit"
                        className="max-sm:h-11"
                        disabled={
                            pending ||
                            options.length < 2 ||
                            resourceId === String(row.resource.id)
                        }
                        aria-busy={pending}
                    >
                        {pending ? (
                            <Spinner role="presentation" aria-hidden="true" />
                        ) : null}
                        {pending ? 'Assigning…' : 'Assign resource'}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
