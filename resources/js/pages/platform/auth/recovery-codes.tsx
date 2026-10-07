import { Link } from '@inertiajs/react';
import { TriangleAlertIcon } from 'lucide-react';
import { AuthCard } from '@/components/platform/auth-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ALERT_TONES } from '@/lib/tones';

export default function RecoveryCodes({ codes }: { codes: string[] }) {
    return (
        <AuthCard
            title="Save your recovery codes"
            description="Use one of these if you lose your authenticator. Each works once."
        >
            <div className="grid gap-4">
                <Alert className={ALERT_TONES.warning}>
                    <TriangleAlertIcon aria-hidden="true" />
                    <AlertDescription>
                        These codes are shown only now and are stored only as
                        hashes. Save them somewhere safe before you leave this
                        page.
                    </AlertDescription>
                </Alert>
                <ul
                    aria-label="Recovery codes"
                    className="grid grid-cols-2 gap-2 font-mono text-base tabular-nums"
                >
                    {codes.map((code) => (
                        <li key={code} className="rounded-md border px-3 py-2">
                            {code}
                        </li>
                    ))}
                </ul>
                <Button asChild className="max-sm:h-11">
                    <Link href="/platform">I have saved them: continue</Link>
                </Button>
            </div>
        </AuthCard>
    );
}
