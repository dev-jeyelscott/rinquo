import { Head } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StatusChip } from '@/components/owner/status-chip';
import { TextField } from '@/components/owner/form-field';
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
            <Head title="Administrators" />
            <h1 className="text-2xl font-semibold tracking-tight">
                Administrators
            </h1>
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
                    <ul className="divide-y">
                        {admins.map((admin) => (
                            <li
                                key={admin.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {admin.name}
                                        {admin.email === me ? ' (you)' : ''}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {admin.email}
                                        {admin.lastLoginAt
                                            ? `, last sign-in ${formatInstant(admin.lastLoginAt, tz)}`
                                            : ', never signed in'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
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
                                    <StatusChip>
                                        {admin.factorEnrolled
                                            ? 'Factor enrolled'
                                            : 'No factor'}
                                    </StatusChip>
                                    {admin.email !== me &&
                                    admin.status === 'active' ? (
                                        <>
                                            <StepUpDialog
                                                label="Reset factor"
                                                ariaLabel={`Reset factor for ${admin.email}`}
                                                title={`Reset the second factor for ${admin.email}`}
                                                description="Clears their authenticator and recovery codes and signs them out. They must enroll a new factor at next sign-in."
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
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
            <SectionCard title="Pending invitations">
                {invitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No pending invitations.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {invitations.map((invitation) => (
                            <li
                                key={invitation.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                                <div>
                                    <p className="font-medium">
                                        {invitation.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Expires{' '}
                                        {formatInstant(
                                            invitation.expiresAt,
                                            tz,
                                        )}
                                    </p>
                                </div>
                                <StepUpDialog
                                    label="Revoke"
                                    ariaLabel={`Revoke invitation for ${invitation.email}`}
                                    title={`Revoke the invitation for ${invitation.email}`}
                                    description="The link stops working immediately."
                                    confirmLabel="Revoke invitation"
                                    pendingLabel="Revoking..."
                                    url={`/platform/admins/invitations/${invitation.id}/revoke`}
                                    confirmVariant="destructive"
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </>
    );
}
