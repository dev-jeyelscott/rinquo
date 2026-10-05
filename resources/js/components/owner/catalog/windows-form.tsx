import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { WeeklyIntervalsEditor } from '@/components/owner/weekly-intervals-editor';
import { Button } from '@/components/ui/button';
import type { Interval } from '@/types/owner';

type Props = {
    url: string;
    serviceName: string;
    windows: { weekday: number; startsAt: string; endsAt: string }[];
};

/** Weekly local-time windows during which a service may be offered. */
export function WindowsForm({ url, serviceName, windows }: Props) {
    const form = useForm<{ windows: Interval[] }>({
        windows: windows.map((window) => ({
            weekday: window.weekday,
            start: window.startsAt,
            end: window.endsAt,
        })),
    });

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            windows: data.windows.map((window) => ({
                weekday: window.weekday,
                starts_at: window.start,
                ends_at: window.end,
            })),
        }));
        form.put(url, { preserveScroll: true });
    }

    return (
        <form
            onSubmit={submit}
            aria-label={`Service windows for ${serviceName}`}
            noValidate
            className="grid gap-3"
        >
            <WeeklyIntervalsEditor
                name={`${serviceName} windows`}
                value={form.data.windows}
                onChange={(next) => form.setData('windows', next)}
                errors={form.errors as Record<string, string | undefined>}
                errorPrefix="windows"
                startKey="starts_at"
                endKey="ends_at"
                emptyMessage="No windows yet. Without a window this service cannot be booked."
            />
            <div>
                <Button
                    type="submit"
                    size="sm"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? 'Saving...' : 'Save windows'}
                </Button>
            </div>
        </form>
    );
}
