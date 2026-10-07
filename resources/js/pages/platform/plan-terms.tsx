import { Head, usePage } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField, TextareaField } from '@/components/owner/form-field';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import { formatInstant } from '@/lib/datetime';
import { centavosToPesos, formatCentavos, pesosToCentavos } from '@/lib/money';
import type { PlanTermsValues, PlanTermsVersion } from '@/types/platform';

type Props = {
    current: PlanTermsValues;
    history: PlanTermsVersion[];
    now: string;
};

/** A datetime-local value for the browser's input, two days from the server's now. */
function defaultEffective(now: string, tz: string): string {
    const instant = new Date(new Date(now).getTime() + 2 * 86400000);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(instant);
    const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? '00';

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Interprets a wall-clock value in the display timezone (Asia/Manila is UTC+8 with no DST). */
function toInstant(local: string): string {
    return `${local}:00+08:00`;
}

export default function PlanTerms({ current, history, now }: Props) {
    const tz = usePage().props.displayTimezone;

    return (
        <>
            <Head title="Plan terms" />
            <h1 className="text-2xl font-semibold tracking-tight">
                Plan terms
            </h1>
            <SectionCard
                title="In force now"
                description="One global plan for every organization. There are no per-tenant prices."
            >
                <dl className="grid gap-1 text-sm tabular-nums sm:max-w-sm">
                    <div className="flex justify-between gap-4">
                        <dt>Monthly price</dt>
                        <dd>{formatCentavos(current.amountCentavos)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt>Trial for new organizations</dt>
                        <dd>{current.trialDays} days</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt>Grace after a period ends</dt>
                        <dd>{current.graceDays} days</dd>
                    </div>
                </dl>
                <div className="mt-4">
                    <StepUpDialog
                        label="Publish new terms"
                        title="Publish new plan terms"
                        description="Applies platform-wide from the effective time. New renewal requests use the new price; issued requests, paid periods and recorded trial and grace dates do not change."
                        confirmLabel="Publish terms"
                        pendingLabel="Publishing..."
                        url="/platform/plan-terms"
                        triggerVariant="default"
                        initial={{
                            price: centavosToPesos(current.amountCentavos),
                            amount_centavos: current.amountCentavos,
                            effective_at: toInstant(defaultEffective(now, tz)),
                            trial_days: current.trialDays,
                            grace_days: current.graceDays,
                            effective_local: defaultEffective(now, tz),
                            reason: '',
                        }}
                    >
                        {(form) => {
                            const centavos = pesosToCentavos(
                                String(form.data.price),
                            );

                            return (
                                <div className="grid gap-3">
                                    <TextField
                                        label="Monthly price (PHP)"
                                        inputMode="decimal"
                                        required
                                        value={String(form.data.price)}
                                        onChange={(event) => {
                                            form.setData(
                                                'price',
                                                event.target.value,
                                            );
                                            const next = pesosToCentavos(
                                                event.target.value,
                                            );
                                            form.setData(
                                                'amount_centavos',
                                                next ?? 0,
                                            );
                                        }}
                                        error={
                                            form.errors.amount_centavos ??
                                            (centavos === null
                                                ? 'Enter a price such as 999 or 999.50.'
                                                : undefined)
                                        }
                                    />
                                    <TextField
                                        label="Trial days"
                                        inputMode="numeric"
                                        required
                                        value={String(form.data.trial_days)}
                                        onChange={(event) =>
                                            form.setData(
                                                'trial_days',
                                                Number(
                                                    event.target.value.replace(
                                                        /\D/g,
                                                        '',
                                                    ),
                                                ) || 0,
                                            )
                                        }
                                        error={form.errors.trial_days}
                                    />
                                    <TextField
                                        label="Grace days"
                                        inputMode="numeric"
                                        required
                                        value={String(form.data.grace_days)}
                                        onChange={(event) =>
                                            form.setData(
                                                'grace_days',
                                                Number(
                                                    event.target.value.replace(
                                                        /\D/g,
                                                        '',
                                                    ),
                                                ) || 0,
                                            )
                                        }
                                        error={form.errors.grace_days}
                                    />
                                    <TextField
                                        label="Effective from (Manila time)"
                                        type="datetime-local"
                                        required
                                        value={String(
                                            form.data.effective_local,
                                        )}
                                        onChange={(event) => {
                                            form.setData(
                                                'effective_local',
                                                event.target.value,
                                            );
                                            form.setData(
                                                'effective_at',
                                                toInstant(event.target.value),
                                            );
                                        }}
                                        error={form.errors.effective_at}
                                    />
                                    <TextareaField
                                        label="Reason for the change"
                                        required
                                        maxLength={500}
                                        value={String(form.data.reason)}
                                        onChange={(event) =>
                                            form.setData(
                                                'reason',
                                                event.target.value,
                                            )
                                        }
                                        error={form.errors.reason}
                                    />
                                </div>
                            );
                        }}
                    </StepUpDialog>
                </div>
            </SectionCard>
            <SectionCard
                title="History"
                description="Every published version, newest first. Versions cannot be edited or deleted."
            >
                {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing has been published. The deployment defaults
                        above are in force.
                    </p>
                ) : (
                    <ul className="divide-y text-sm tabular-nums">
                        {history.map((version) => (
                            <li key={version.id} className="grid gap-1 py-3">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">
                                        {formatCentavos(version.amountCentavos)}
                                        , trial {version.trialDays}d, grace{' '}
                                        {version.graceDays}d
                                    </span>
                                    <StatusChip
                                        tone={
                                            version.inForce ? 'success' : 'info'
                                        }
                                    >
                                        {version.inForce
                                            ? 'In force'
                                            : 'Scheduled'}
                                    </StatusChip>
                                </p>
                                <p className="text-muted-foreground">
                                    Effective{' '}
                                    {formatInstant(version.effectiveAt, tz)}.{' '}
                                    {version.reason}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </>
    );
}
