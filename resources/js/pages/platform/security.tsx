import { SectionCard } from '@/components/owner/section-card';
import { PageHeader } from '@/components/platform/page-header';
import { StepUpDialog } from '@/components/platform/step-up-dialog';

export default function Security({
    recoveryCodesRemaining,
}: {
    recoveryCodesRemaining: number;
}) {
    return (
        <>
            <PageHeader
                eyebrow="Security"
                title="Security"
                description="Manage the recovery codes for your own sign-in."
            />
            <SectionCard
                title="Recovery codes"
                description="Single-use codes for signing in without your authenticator."
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                        <span className="tabular-nums">
                            {recoveryCodesRemaining}
                        </span>{' '}
                        unused {recoveryCodesRemaining === 1 ? 'code' : 'codes'}{' '}
                        remaining.
                    </p>
                    <StepUpDialog
                        label="Generate new codes"
                        title="Generate new recovery codes"
                        description="Replaces every existing code, which stops working immediately. The new codes are shown once and cannot be shown again."
                        confirmLabel="Generate codes"
                        pendingLabel="Generating..."
                        url="/platform/security/recovery-codes"
                    />
                </div>
            </SectionCard>
        </>
    );
}
