import { Head, Link } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField, TextareaField } from '@/components/owner/form-field';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import type { MemberRow } from '@/types/platform';

type Props = {
    organization: {
        id: number;
        name: string;
        slug: string;
        published: boolean;
    };
    entitlement: { state: string; closed: boolean };
    members: MemberRow[];
    startUrl: string;
};

export default function OrganizationShow({
    organization,
    entitlement,
    members,
    startUrl,
}: Props) {
    return (
        <>
            <Head title={organization.name} />
            <p>
                <Link
                    href="/platform/organizations"
                    className="text-sm underline underline-offset-4"
                >
                    All organizations
                </Link>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
            </h1>
            <SectionCard title="Status">
                <div className="flex flex-wrap gap-2">
                    <StatusChip>Billing: {entitlement.state}</StatusChip>
                    {entitlement.closed ? (
                        <StatusChip tone="warning">Closed</StatusChip>
                    ) : null}
                    <StatusChip
                        tone={organization.published ? 'success' : 'neutral'}
                    >
                        {organization.published ? 'Published' : 'Not published'}
                    </StatusChip>
                </div>
            </SectionCard>
            <SectionCard
                title="Support access"
                description="Read-only and limited to this organization for 30 minutes. Every view and every blocked attempt is recorded against your name, with the reason and reference you give."
            >
                {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        This organization has no active owner or staff member to
                        view as.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {members.map((member) => (
                            <li
                                key={member.userId}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                                <div>
                                    <p className="font-medium">
                                        {member.email}
                                    </p>
                                    <StatusChip caps>{member.role}</StatusChip>
                                </div>
                                <StepUpDialog
                                    label="View as this member"
                                    ariaLabel={`Start a support session as ${member.email}`}
                                    title="Start a read-only support session"
                                    description={`You will see ${organization.name} with the permissions of ${member.email} (${member.role}). You cannot change anything, and the session ends after 30 minutes.`}
                                    confirmLabel="Start support session"
                                    pendingLabel="Starting..."
                                    url={startUrl}
                                    initial={{
                                        target_user_id: member.userId,
                                        reason: '',
                                        reference: '',
                                    }}
                                    triggerVariant="default"
                                >
                                    {(form) => (
                                        <div className="grid gap-3">
                                            <TextareaField
                                                label="Reason for access"
                                                required
                                                maxLength={500}
                                                hint="At least 10 characters. Stored with the session."
                                                value={String(form.data.reason)}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'reason',
                                                        event.target.value,
                                                    )
                                                }
                                                error={form.errors.reason}
                                            />
                                            <TextField
                                                label="Support or ticket reference"
                                                required
                                                maxLength={120}
                                                value={String(
                                                    form.data.reference,
                                                )}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'reference',
                                                        event.target.value,
                                                    )
                                                }
                                                error={
                                                    form.errors.reference ??
                                                    form.errors.target_user_id
                                                }
                                            />
                                        </div>
                                    )}
                                </StepUpDialog>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </>
    );
}
