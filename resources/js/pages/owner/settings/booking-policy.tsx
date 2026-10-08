import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { SelectField, TextField } from '@/components/owner/form-field';
import { SectionCard } from '@/components/owner/section-card';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';

type ApprovalMode = 'auto_confirm' | 'staff_approval';

type Props = OwnerPageProps & {
    policy: {
        approvalMode: ApprovalMode;
        slotIntervalMinutes: number;
        minNoticeMinutes: number;
        horizonDays: number;
        approvalWindowMinutes: number;
    };
};

const MODES: { value: ApprovalMode; title: string; effect: string }[] = [
    {
        value: 'auto_confirm',
        title: 'Confirm instantly',
        effect: 'Customers get a confirmed booking right away. You are not asked to approve anything.',
    },
    {
        value: 'staff_approval',
        title: 'Approve each request',
        effect: 'Customers send a request and the time is held for them. If nobody decides in time, the request expires and the time is released.',
    },
];

const INTERVALS = [5, 10, 15, 20, 30, 60].map((minutes) => ({
    value: String(minutes),
    label: `${minutes} minutes`,
}));

function formatNotice(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const parts = [
        hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : null,
        rest > 0 ? `${rest} ${rest === 1 ? 'minute' : 'minutes'}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : 'No minimum notice';
}

/**
 * Booking policy tab: the approval mode and the time rules that govern new
 * availability and bookings. The values in force when a customer confirms are
 * snapshotted onto that booking, so edits never rewrite existing bookings.
 */
export default function BookingPolicy({ organization, policy }: Props) {
    const form = useForm({
        approval_mode: policy.approvalMode,
        slot_interval_minutes: String(policy.slotIntervalMinutes),
        notice_hours: String(Math.floor(policy.minNoticeMinutes / 60)),
        notice_minutes: String(policy.minNoticeMinutes % 60),
        horizon_days: String(policy.horizonDays),
        approval_window_minutes: String(policy.approvalWindowMinutes),
    });
    const errors = form.errors as Record<string, string | undefined>;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            approval_mode: data.approval_mode,
            slot_interval_minutes: Number(data.slot_interval_minutes),
            min_notice_minutes:
                Number(data.notice_hours || 0) * 60 +
                Number(data.notice_minutes || 0),
            horizon_days: Number(data.horizon_days),
            approval_window_minutes: Number(data.approval_window_minutes),
        }));
        form.put(`${organization.baseUrl}/booking-policy`, {
            preserveScroll: true,
        });
    }

    return (
        <>
            <SettingsPageHeader section="booking-policy" />
            <form
                onSubmit={submit}
                aria-label="Booking policy"
                noValidate
                className="grid gap-6"
            >
                <div className="grid items-start gap-6 xl:grid-cols-2">
                    <SectionCard
                        title="Confirmation mode"
                        description="Choose whether bookings confirm immediately or need staff approval."
                        contentClassName="grid gap-3"
                    >
                        <fieldset className="grid gap-3">
                            <legend className="sr-only">Approval mode</legend>
                            {MODES.map((mode) => (
                                <label
                                    key={mode.value}
                                    className={cn(
                                        'grid cursor-pointer gap-1 rounded-xl border p-4 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring',
                                    )}
                                >
                                    <span className="flex items-center gap-2 font-semibold">
                                        <input
                                            type="radio"
                                            name="approval_mode"
                                            value={mode.value}
                                            checked={
                                                form.data.approval_mode ===
                                                mode.value
                                            }
                                            onChange={() =>
                                                form.setData(
                                                    'approval_mode',
                                                    mode.value,
                                                )
                                            }
                                            className="size-4 accent-primary"
                                        />
                                        {mode.title}
                                    </span>
                                    <span className="max-w-[66ch] pl-6 text-sm text-muted-foreground">
                                        {mode.effect}
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        {errors.approval_mode ? (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.approval_mode}
                            </p>
                        ) : null}
                        {form.data.approval_mode === 'staff_approval' ? (
                            <TextField
                                label="Approval response window (minutes)"
                                type="number"
                                inputMode="numeric"
                                min={15}
                                max={1440}
                                required
                                hint="How long you have to decide, from 15 minutes to 24 hours. The request never outlasts the appointment start."
                                value={form.data.approval_window_minutes}
                                onChange={(event) =>
                                    form.setData(
                                        'approval_window_minutes',
                                        event.target.value,
                                    )
                                }
                                error={errors.approval_window_minutes}
                            />
                        ) : null}
                    </SectionCard>

                    <SectionCard
                        title="Scheduling rules"
                        description="These rules shape which start times customers can select. Same-day booking is allowed when the minimum notice is satisfied."
                        contentClassName="grid gap-4 sm:grid-cols-2"
                    >
                        <SelectField
                            label="Time slot interval"
                            required
                            options={INTERVALS}
                            value={form.data.slot_interval_minutes}
                            onChange={(event) =>
                                form.setData(
                                    'slot_interval_minutes',
                                    event.target.value,
                                )
                            }
                            error={errors.slot_interval_minutes}
                            hint="Start times fall on this grid from midnight."
                        />
                        <TextField
                            label="Booking horizon (days)"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={365}
                            required
                            hint="How far ahead customers can book, up to 365 days."
                            value={form.data.horizon_days}
                            onChange={(event) =>
                                form.setData('horizon_days', event.target.value)
                            }
                            error={errors.horizon_days}
                        />
                        <fieldset className="grid gap-1.5 sm:col-span-2">
                            <legend className="mb-1.5 text-sm font-medium">
                                Minimum notice
                            </legend>
                            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                                <TextField
                                    label="Hours"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={168}
                                    value={form.data.notice_hours}
                                    onChange={(event) =>
                                        form.setData(
                                            'notice_hours',
                                            event.target.value,
                                        )
                                    }
                                />
                                <TextField
                                    label="Minutes"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={59}
                                    value={form.data.notice_minutes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notice_minutes',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                The earliest a customer can book from now, up to
                                7 days.
                            </p>
                            {errors.min_notice_minutes ? (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {errors.min_notice_minutes}
                                </p>
                            ) : null}
                        </fieldset>
                    </SectionCard>
                </div>

                <SectionCard
                    title="Cancellation and rescheduling"
                    description="Customers can cancel or reschedule on their own until the minimum notice before the appointment. After that, Staff handles exceptions."
                >
                    <p className="max-w-[66ch] rounded-xl bg-info/10 p-4 text-sm">
                        <strong>Self-service cutoff: </strong>
                        {formatNotice(policy.minNoticeMinutes)} before the
                        appointment. Customer self-service cancel and reschedule
                        is disabled after that. No cancellation fees or deposits
                        apply.
                    </p>
                </SectionCard>

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
                        {form.processing ? 'Saving...' : 'Save booking policy'}
                    </Button>
                </div>
            </form>
        </>
    );
}
