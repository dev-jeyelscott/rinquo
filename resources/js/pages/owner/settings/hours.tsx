import { useForm } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { FormEvent } from 'react';
import { CheckboxField, TextField } from '@/components/owner/form-field';
import { DayHoursEditor } from '@/components/owner/day-hours-editor';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SectionCard } from '@/components/owner/section-card';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import type { Interval, OwnerPageProps } from '@/types/owner';

type Override = {
    localDate: string;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
};

type Props = OwnerPageProps & {
    weekly: { weekday: number; opensAt: string; closesAt: string }[];
    overrides: Override[];
    branchTimezone: string;
};

type OverrideDraft = {
    local_date: string;
    is_closed: boolean;
    opens_at: string;
    closes_at: string;
};

export default function Hours({
    organization,
    weekly,
    overrides,
    branchTimezone,
}: Props) {
    const form = useForm<{
        weekly: Interval[];
        overrides: OverrideDraft[];
    }>({
        weekly: weekly.map((row) => ({
            weekday: row.weekday,
            start: row.opensAt,
            end: row.closesAt,
        })),
        overrides: overrides.map((row) => ({
            local_date: row.localDate,
            is_closed: row.isClosed,
            opens_at: row.opensAt ?? '',
            closes_at: row.closesAt ?? '',
        })),
    });
    const errors = form.errors as Record<string, string | undefined>;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            weekly: data.weekly.map((row) => ({
                weekday: row.weekday,
                opens_at: row.start,
                closes_at: row.end,
            })),
            overrides: data.overrides.map((row) => ({
                local_date: row.local_date,
                is_closed: row.is_closed,
                opens_at: row.is_closed ? null : row.opens_at,
                closes_at: row.is_closed ? null : row.closes_at,
            })),
        }));
        form.put(`${organization.baseUrl}/hours`, { preserveScroll: true });
    }

    const updateOverride = (index: number, patch: Partial<OverrideDraft>) =>
        form.setData(
            'overrides',
            form.data.overrides.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );

    return (
        <>
            <SettingsPageHeader section="hours" />
            <form
                onSubmit={submit}
                aria-label="Business hours"
                noValidate
                className="grid gap-6"
            >
                <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
                    <SectionCard
                        title="Weekly operating hours"
                        description={`Local times in ${branchTimezone}. Several intervals per day support breaks. A closed day has no intervals. At least one open day is required to publish.`}
                    >
                        <DayHoursEditor
                            name="Opening hours"
                            value={form.data.weekly}
                            onChange={(next) => form.setData('weekly', next)}
                            errors={errors}
                            errorPrefix="weekly"
                            startKey="opens_at"
                            endKey="closes_at"
                            emptyMessage="No opening hours yet. Your shop cannot be published."
                        />
                    </SectionCard>
                    <SectionCard
                        title="Date overrides"
                        description="A date override replaces the weekly hours for that calendar date, for example a holiday closure."
                        contentClassName="grid gap-3"
                    >
                        {form.data.overrides.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No overrides.
                            </p>
                        ) : null}
                        {form.data.overrides.map((row, index) => (
                            <div
                                key={index}
                                className="grid items-end gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto_1fr_1fr_auto]"
                            >
                                <TextField
                                    label={`Override ${index + 1} date`}
                                    type="date"
                                    value={row.local_date}
                                    onChange={(event) =>
                                        updateOverride(index, {
                                            local_date: event.target.value,
                                        })
                                    }
                                    error={
                                        errors[`overrides.${index}.local_date`]
                                    }
                                />
                                <CheckboxField
                                    label="Closed all day"
                                    checked={row.is_closed}
                                    onChange={(event) =>
                                        updateOverride(index, {
                                            is_closed: event.target.checked,
                                        })
                                    }
                                />
                                <TextField
                                    label={`Override ${index + 1} opens`}
                                    type="time"
                                    disabled={row.is_closed}
                                    value={row.opens_at}
                                    onChange={(event) =>
                                        updateOverride(index, {
                                            opens_at: event.target.value,
                                        })
                                    }
                                    error={
                                        errors[`overrides.${index}.opens_at`]
                                    }
                                />
                                <TextField
                                    label={`Override ${index + 1} closes`}
                                    type="time"
                                    disabled={row.is_closed}
                                    value={row.closes_at}
                                    onChange={(event) =>
                                        updateOverride(index, {
                                            closes_at: event.target.value,
                                        })
                                    }
                                    error={
                                        errors[`overrides.${index}.closes_at`]
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="max-sm:size-11"
                                    aria-label={`Remove override ${index + 1}`}
                                    onClick={() =>
                                        form.setData(
                                            'overrides',
                                            form.data.overrides.filter(
                                                (_, i) => i !== index,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2Icon aria-hidden="true" />
                                </Button>
                            </div>
                        ))}
                        <div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    form.setData('overrides', [
                                        ...form.data.overrides,
                                        {
                                            local_date: '',
                                            is_closed: true,
                                            opens_at: '',
                                            closes_at: '',
                                        },
                                    ])
                                }
                            >
                                <PlusIcon aria-hidden="true" />
                                Add override
                            </Button>
                        </div>
                    </SectionCard>
                </div>
                <div>
                    <Button
                        type="submit"
                        className="max-sm:h-11"
                        disabled={form.processing}
                        aria-busy={form.processing}
                    >
                        {form.processing ? (
                            <Spinner role="presentation" aria-hidden="true" />
                        ) : null}
                        {form.processing ? 'Saving...' : 'Save business hours'}
                    </Button>
                </div>
            </form>
        </>
    );
}
