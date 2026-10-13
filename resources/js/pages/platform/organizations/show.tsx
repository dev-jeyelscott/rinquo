import { Link } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField, TextareaField } from '@/components/owner/form-field';
import { PageHeader } from '@/components/platform/page-header';
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
            <PageHeader
                eyebrow="Platform"
                title={organization.name}
                description="Confirm who you will view as and why access is needed."
            />
            <p>
                <Link
                    href="/platform/organizations"
                    className="inline-flex items-center text-sm text-primary underline underline-offset-4 max-sm:min-h-11"
                >
                    All organizations
                </Link>
            </p>
            <SectionCard
                title="Status"
                description="Allowed organization status only. Nothing here can be changed from Platform."
            >
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
                title="Eligible support members"
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
                                <div className="grid min-w-0 gap-1">
                                    <p className="font-medium [overflow-wrap:anywhere]">
                                        {member.email}
                                    </p>
                                    <StatusChip caps className="w-fit">
                                        {member.role}
                                    </StatusChip>
                                </div>
                                <StepUpDialog
                                    label="View as this member"
                                    ariaLabel={`Start a support session as ${member.email}`}
                                    title="Start a read-only support session"
                                    description={`View ${organization.name} as ${member.email} (${member.role}). Limited to 30 minutes and cannot be extended. Every view and blocked attempt is audited.`}
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
                                                controlClassName="max-sm:h-11"
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
