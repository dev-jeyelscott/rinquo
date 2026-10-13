import { Head, usePage } from '@inertiajs/react';
import { CheckIcon, InfoIcon } from 'lucide-react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField, TextareaField } from '@/components/owner/form-field';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ALERT_TONES } from '@/lib/tones';
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
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid min-w-0 gap-6">
                    <Alert className={ALERT_TONES.info} role="note">
                        <InfoIcon aria-hidden="true" />
                        <AlertTitle className="text-base font-semibold">
                            One global monthly plan
                        </AlertTitle>
                        <AlertDescription>
                            <p className="max-w-[65ch]">
                                Publish effective-dated plan terms. There is no
                                per-tenant pricing.
                            </p>
                        </AlertDescription>
                    </Alert>
                    <SectionCard
                        title="Summary"
                        description="In force now, for every organization."
                    >
                        <dl className="grid gap-x-8 gap-y-4 text-sm tabular-nums sm:grid-cols-2">
                            <div className="grid gap-0.5">
                                <dt className="text-muted-foreground">
                                    Monthly price
                                </dt>
                                <dd className="font-semibold">
                                    {formatCentavos(current.amountCentavos)}
                                </dd>
                            </div>
                            <div className="grid gap-0.5">
                                <dt className="text-muted-foreground">
                                    Trial for new organizations
                                </dt>
                                <dd className="font-semibold">
                                    {current.trialDays} days
                                </dd>
                            </div>
                            <div className="grid gap-0.5">
                                <dt className="text-muted-foreground">
                                    Grace after a paid period ends
                                </dt>
                                <dd className="font-semibold">
                                    {current.graceDays} days
                                </dd>
                            </div>
                            <div className="grid gap-0.5">
                                <dt className="text-muted-foreground">
                                    Pricing scope
                                </dt>
                                <dd className="font-semibold">
                                    All organizations
                                </dd>
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
                                    price: centavosToPesos(
                                        current.amountCentavos,
                                    ),
                                    amount_centavos: current.amountCentavos,
                                    effective_at: toInstant(
                                        defaultEffective(now, tz),
                                    ),
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
                                                    const next =
                                                        pesosToCentavos(
                                                            event.target.value,
                                                        );
                                                    form.setData(
                                                        'amount_centavos',
                                                        next ?? 0,
                                                    );
                                                }}
                                                error={
                                                    form.errors
                                                        .amount_centavos ??
                                                    (centavos === null
                                                        ? 'Enter a price such as 999 or 999.50.'
                                                        : undefined)
                                                }
                                            />
                                            <TextField
                                                label="Trial days"
                                                inputMode="numeric"
                                                required
                                                value={String(
                                                    form.data.trial_days,
                                                )}
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
                                                value={String(
                                                    form.data.grace_days,
                                                )}
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
                                                        toInstant(
                                                            event.target.value,
                                                        ),
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
                        title="Published history"
                        description="Every published version, newest first. Existing payment requests and paid periods keep their recorded values."
                    >
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nothing has been published. The deployment
                                defaults above are in force.
                            </p>
                        ) : (
                            <ul className="divide-y text-sm tabular-nums">
                                {history.map((version) => (
                                    <li
                                        key={version.id}
                                        className="grid gap-1 py-3"
                                    >
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {formatCentavos(
                                                    version.amountCentavos,
                                                )}
                                                , trial {version.trialDays}d,
                                                grace {version.graceDays}d
                                            </span>
                                            <StatusChip
                                                tone={
                                                    version.inForce
                                                        ? 'success'
                                                        : 'info'
                                                }
                                            >
                                                {version.inForce
                                                    ? 'In force'
                                                    : 'Scheduled'}
                                            </StatusChip>
                                        </p>
                                        <p className="text-muted-foreground">
                                            Effective{' '}
                                            {formatInstant(
                                                version.effectiveAt,
                                                tz,
                                            )}
                                            . {version.reason}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </div>
                <aside aria-label="Plan term guarantees" className="grid gap-6">
                    <SectionCard title="What remains true">
                        <ul className="grid gap-3 text-sm">
                            {[
                                'One global monthly price',
                                'Time-effective immutable plan versions',
                                'Existing paid periods keep their dates',
                                'Admin authentication and step-up required',
                            ].map((line) => (
                                <li
                                    key={line}
                                    className="flex items-start gap-2.5"
                                >
                                    <CheckIcon
                                        aria-hidden="true"
                                        className="mt-0.5 size-4 shrink-0 text-success"
                                    />
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                    <SectionCard title="Versioning">
                        <p className="text-sm text-muted-foreground">
                            Plan terms are effective-dated. Previous versions
                            cannot be edited or deleted.
                        </p>
                    </SectionCard>
                </aside>
            </div>
        </>
    );
}
