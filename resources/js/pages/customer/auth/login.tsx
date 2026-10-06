import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
export default function Login({
    step,
    email,
}: {
    step: 'email' | 'code';
    email: string | null;
}) {
    const form = useForm({ email: '', code: '' });
    const code = step === 'code';
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (code) form.post('/account/auth/verify');
        else form.post('/account/auth/code');
    }
    return (
        <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
            <Head title="Sign in to Rinquo" />
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Rinquo account</CardTitle>
                    <CardDescription>
                        {code
                            ? `Enter the code sent to ${email}.`
                            : 'Sign in with a verification code to see your bookings across shops.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-3" onSubmit={submit}>
                        <Input
                            aria-label={
                                code ? 'Verification code' : 'Email address'
                            }
                            type={code ? 'text' : 'email'}
                            inputMode={code ? 'numeric' : undefined}
                            maxLength={code ? 6 : undefined}
                            value={code ? form.data.code : form.data.email}
                            onChange={(event) =>
                                form.setData(
                                    code ? 'code' : 'email',
                                    event.target.value,
                                )
                            }
                        />
                        <Button disabled={form.processing}>
                            {form.processing
                                ? code
                                    ? 'Verifying...'
                                    : 'Sending...'
                                : code
                                  ? 'Verify code'
                                  : 'Send code'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
