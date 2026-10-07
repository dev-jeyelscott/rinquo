import { Head } from '@inertiajs/react';
import { SectionCard } from '@/components/owner/section-card';
import { StepUpDialog } from '@/components/platform/step-up-dialog';

export default function Security({
    recoveryCodesRemaining,
}: {
    recoveryCodesRemaining: number;
}) {
    return (
        <>
            <Head title="Security" />
            <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
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
                        description="Replaces every existing code. The new codes are shown once."
                        confirmLabel="Generate codes"
                        pendingLabel="Generating..."
                        url="/platform/security/recovery-codes"
                    />
                </div>
            </SectionCard>
        </>
    );
}
