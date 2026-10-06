import { Head, useForm } from '@inertiajs/react';
import CustomerShell from '@/layouts/customer-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Profile = { name: string; phone: string; email: string };
export default function Profile({
    profile,
    emailChangePending,
}: {
    profile: Profile;
    emailChangePending: boolean;
}) {
    const form = useForm({ name: profile.name, phone: profile.phone });
    const email = useForm({ email: '' });
    const code = useForm({ code: '' });
    return (
        <CustomerShell>
            <Head title="Profile" />
            <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Your Rinquo profile</CardTitle>
                        <CardDescription>
                            This information belongs to your platform account,
                            not to an individual shop.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.patch('/account/profile');
                            }}
                        >
                            <Input
                                aria-label="Name"
                                placeholder="Name"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                            />
                            <Input
                                aria-label="Phone"
                                placeholder="Phone (optional)"
                                value={form.data.phone}
                                onChange={(e) =>
                                    form.setData('phone', e.target.value)
                                }
                            />
                            <Button disabled={form.processing}>
                                {form.processing ? 'Saving...' : 'Save profile'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Change email</CardTitle>
                        <CardDescription>
                            Current email: {profile.email}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {emailChangePending ? (
                            <form
                                className="grid gap-3"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    code.post(
                                        '/account/profile/email-change/verify',
                                    );
                                }}
                            >
                                <p className="text-sm text-muted-foreground">
                                    Enter the code sent to your new address.
                                    Your email changes only after this
                                    verification.
                                </p>
                                <Input
                                    aria-label="Verification code"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code.data.code}
                                    onChange={(e) =>
                                        code.setData('code', e.target.value)
                                    }
                                />
                                <Button disabled={code.processing}>
                                    {code.processing
                                        ? 'Verifying...'
                                        : 'Verify new email'}
                                </Button>
                            </form>
                        ) : (
                            <form
                                className="grid gap-3"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    email.post('/account/profile/email-change');
                                }}
                            >
                                <Input
                                    aria-label="New email address"
                                    type="email"
                                    placeholder="New email address"
                                    value={email.data.email}
                                    onChange={(e) =>
                                        email.setData('email', e.target.value)
                                    }
                                />
                                <Button disabled={email.processing}>
                                    {email.processing
                                        ? 'Sending...'
                                        : 'Send verification code'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </CustomerShell>
    );
}
