import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    SelectField,
    TextareaField,
    TextField,
} from '@/components/owner/form-field';
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
import { wallTimeToInstant } from '@/lib/booking-format';
import type { ResourceOption } from '@/types/operations';

type Props = { url: string; resources: ResourceOption[]; timezone: string };

/**
 * Takes one resource out of service for a period (for example a bay under
 * repair). When bookings sit in that time the server answers with an impact
 * review (see ScheduleImpactDialog) instead of writing: bookings that fit
 * another compatible resource keep their time, the rest become scheduling
 * conflicts for staff, so a block never silently overbooks or strands anyone.
 */
export function BlockResourceSheet({ url, resources, timezone }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        resource_id: '',
        starts_local: '',
        ends_local: '',
        reason: '',
    });
    const errors = form.errors as Record<string, string | undefined>;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            resource_id: Number(data.resource_id),
            starts_at: wallTimeToInstant(data.starts_local, timezone),
            ends_at: wallTimeToInstant(data.ends_local, timezone),
            reason: data.reason,
        }));
        form.post(url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="max-sm:h-11">
                    Block a resource
                </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[92%] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 sm:w-[40vw] sm:max-w-md sm:min-w-80">
                <form
                    onSubmit={submit}
                    aria-label="Block a resource"
                    noValidate
                    className="grid gap-4 p-4"
                >
                    <SheetHeader className="p-0">
                        <SheetTitle>Block a resource</SheetTitle>
                        <SheetDescription>
                            No bookings or walk-ins can use it during the block.
                            If bookings are affected you review the impact
                            before anything changes.
                        </SheetDescription>
                    </SheetHeader>
                    <SelectField
                        label="Resource"
                        required
                        placeholder="Choose a resource"
                        value={form.data.resource_id}
                        error={errors.resource_id}
                        onChange={(event) =>
                            form.setData('resource_id', event.target.value)
                        }
                        options={resources.map((resource) => ({
                            value: String(resource.id),
                            label: resource.name,
                        }))}
                    />
                    <TextField
                        label="From (Philippine time)"
                        type="datetime-local"
                        required
                        value={form.data.starts_local}
                        error={errors.starts_at}
                        onChange={(event) =>
                            form.setData('starts_local', event.target.value)
                        }
                    />
                    <TextField
                        label="Until (Philippine time)"
                        type="datetime-local"
                        required
                        value={form.data.ends_local}
                        error={errors.ends_at}
                        onChange={(event) =>
                            form.setData('ends_local', event.target.value)
                        }
                    />
                    <TextareaField
                        label="Reason"
                        required
                        maxLength={500}
                        value={form.data.reason}
                        error={errors.reason}
                        onChange={(event) =>
                            form.setData('reason', event.target.value)
                        }
                    />
                    <Button
                        type="submit"
                        className="max-sm:h-11"
                        disabled={form.processing}
                        aria-busy={form.processing}
                    >
                        {form.processing ? (
                            <Spinner role="presentation" aria-hidden="true" />
                        ) : null}
                        {form.processing ? 'Blocking…' : 'Block resource'}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
