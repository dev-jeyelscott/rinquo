import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField } from '@/components/owner/form-field';
import { PageHeader } from '@/components/platform/page-header';
import { RecordTable } from '@/components/platform/record-table';
import { StepUpDialog } from '@/components/platform/step-up-dialog';
import { usePage } from '@inertiajs/react';
import type { AdminRow, InvitationRow } from '@/types/platform';
import { formatInstant } from '@/lib/datetime';

type Props = { admins: AdminRow[]; invitations: InvitationRow[] };

export default function Admins({ admins, invitations }: Props) {
    const { props } = usePage();
    const tz = props.displayTimezone;
    const me = props.platform?.admin?.email;

    return (
        <>
            <PageHeader
                eyebrow="Security"
                title="Administrators"
                description="Manage Platform identities. Every change needs your password and a fresh authenticator code."
            />
            <SectionCard
                title="Invite an administrator"
                description="They get a single-use link that expires, then set a password and an authenticator."
            >
                <StepUpDialog
                    label="Invite administrator"
                    title="Invite an administrator"
                    description="Sends a single-use invitation link. It cannot be reused and expires in 72 hours."
                    confirmLabel="Send invitation"
                    pendingLabel="Sending..."
                    url="/platform/admins/invitations"
                    initial={{ email: '' }}
                    triggerVariant="default"
                >
                    {(form) => (
                        <TextField
                            controlClassName="max-sm:h-11"
                            label="Email address"
                            type="email"
                            name="email"
                            autoComplete="off"
                            required
                            value={String(form.data.email)}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                            error={form.errors.email}
                        />
                    )}
                </StepUpDialog>
            </SectionCard>
            <SectionCard
                title="Administrators"
                description="Disabling signs the person out everywhere and removes their factor."
            >
                {admins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No administrators.
                    </p>
                ) : (
                    <RecordTable
                        label="Administrators"
                        columns={[
                            { key: 'identity', label: 'Administrator' },
                            { key: 'status', label: 'Status' },
                            { key: 'factor', label: 'Factor' },
                            { key: 'actions', label: 'Actions' },
                        ]}
                        rows={admins}
                        rowKey={(admin) => admin.id}
                        template="md:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.6fr)]"
                        cell={(admin, key) => {
                            switch (key) {
                                case 'identity':
                                    return (
                                        <>
                                            <p className="font-semibold">
                                                {admin.name}
                                                {admin.email === me
                                                    ? ' (you)'
                                                    : ''}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {admin.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {admin.lastLoginAt
                                                    ? `Last sign-in ${formatInstant(admin.lastLoginAt, tz)}`
                                                    : 'Never signed in'}
                                            </p>
                                        </>
                                    );
                                case 'status':
                                    return (
                                        <StatusChip
                                            tone={
                                                admin.status === 'active'
                                                    ? 'success'
                                                    : 'warning'
                                            }
                                        >
                                            {admin.status === 'active'
                                                ? 'Active'
                                                : 'Disabled'}
                                        </StatusChip>
                                    );
                                case 'factor':
                                    return (
                                        <StatusChip>
                                            {admin.factorEnrolled
                                                ? 'Factor enrolled'
                                                : 'No factor'}
                                        </StatusChip>
                                    );
                                default:
                                    return (
                                        <span className="flex flex-wrap gap-2 md:justify-start">
                                            {admin.email !== me &&
                                            admin.status === 'active' ? (
                                                <>
                                                    <StepUpDialog
                                                        label="Reset factor"
                                                        ariaLabel={`Reset factor for ${admin.email}`}
                                                        title={`Reset the second factor for ${admin.email}`}
                                                        description="Clears their authenticator and recovery codes and signs them out. They must enroll a new factor at next sign-in. This cannot be undone."
                                                        confirmLabel="Reset factor"
                                                        pendingLabel="Resetting..."
                                                        url={`/platform/admins/${admin.id}/reset-factor`}
                                                    />
                                                    <StepUpDialog
                                                        label="Disable"
                                                        ariaLabel={`Disable ${admin.email}`}
                                                        title={`Disable ${admin.email}`}
                                                        description="Signs them out everywhere, removes their factor and recovery codes, ends their support session and revokes their pending invitations."
                                                        confirmLabel="Disable administrator"
                                                        pendingLabel="Disabling..."
                                                        url={`/platform/admins/${admin.id}/disable`}
                                                        confirmVariant="destructive"
                                                    />
                                                </>
                                            ) : null}
                                            {admin.status === 'disabled' ? (
                                                <StepUpDialog
                                                    label="Re-enable"
                                                    ariaLabel={`Re-enable ${admin.email}`}
                                                    title={`Re-enable ${admin.email}`}
                                                    description="Restores sign-in with their password. They must enroll a new authenticator first."
                                                    confirmLabel="Re-enable"
                                                    pendingLabel="Re-enabling..."
                                                    url={`/platform/admins/${admin.id}/enable`}
                                                />
                                            ) : null}
                                        </span>
                                    );
                            }
                        }}
                    />
                )}
            </SectionCard>
            <SectionCard title="Pending invitations">
                {invitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No pending invitations.
                    </p>
                ) : (
                    <RecordTable
                        label="Pending invitations"
                        columns={[
                            { key: 'email', label: 'Invitee' },
                            { key: 'expires', label: 'Expires' },
                            {
                                key: 'actions',
                                label: 'Action',
                                className: 'md:text-right',
                            },
                        ]}
                        rows={invitations}
                        rowKey={(invitation) => invitation.id}
                        template="md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,0.8fr)]"
                        cell={(invitation, key) => {
                            switch (key) {
                                case 'email':
                                    return (
                                        <span className="font-semibold">
                                            {invitation.email}
                                        </span>
                                    );
                                case 'expires':
                                    return (
                                        <span className="tabular-nums">
                                            {formatInstant(
                                                invitation.expiresAt,
                                                tz,
                                            )}
                                        </span>
                                    );
                                default:
                                    return (
                                        <StepUpDialog
                                            label="Revoke"
                                            ariaLabel={`Revoke invitation for ${invitation.email}`}
                                            title={`Revoke the invitation for ${invitation.email}`}
                                            description="The link stops working immediately. This cannot be undone."
                                            confirmLabel="Revoke invitation"
                                            pendingLabel="Revoking..."
                                            url={`/platform/admins/invitations/${invitation.id}/revoke`}
                                            confirmVariant="destructive"
                                        />
                                    );
                            }
                        }}
                    />
                )}
            </SectionCard>
        </>
    );
}
