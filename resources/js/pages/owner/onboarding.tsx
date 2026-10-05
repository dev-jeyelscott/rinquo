import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ownerRoutes } from '@/lib/routes';
import { slugify } from '@/lib/slug';

type Props = { suggestedBranchName: string; timezone: string };

export default function Onboarding({ suggestedBranchName, timezone }: Props) {
    const form = useForm({
        name: '',
        slug: '',
        branch_name: suggestedBranchName,
    });
    const [slugEdited, setSlugEdited] = useState(false);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(ownerRoutes.onboarding);
    }

    return (
        <>
            <Head title="Create your organization" />
            <div className="mx-auto w-full max-w-lg py-6">
                <Card className="rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle>
                            <h1 className="text-2xl">
                                Create your organization
                            </h1>
                        </CardTitle>
                        <CardDescription>
                            One organization with one branch. Times use the{' '}
                            {timezone} timezone. Nothing is public until you
                            publish.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={submit}
                            className="grid gap-4"
                            noValidate
                        >
                            <TextField
                                label="Business name"
                                name="name"
                                required
                                maxLength={120}
                                value={form.data.name}
                                onChange={(event) => {
                                    form.setData('name', event.target.value);
                                    if (!slugEdited) {
                                        form.setData(
                                            'slug',
                                            slugify(event.target.value),
                                        );
                                    }
                                }}
                                error={form.errors.name}
                            />
                            <TextField
                                label="Shop address"
                                name="slug"
                                required
                                maxLength={63}
                                hint="Lowercase letters, numbers and hyphens. Your page will be at /shops/your-address."
                                value={form.data.slug}
                                onChange={(event) => {
                                    setSlugEdited(true);
                                    form.setData(
                                        'slug',
                                        event.target.value.toLowerCase(),
                                    );
                                }}
                                error={form.errors.slug}
                            />
                            <TextField
                                label="Branch name"
                                name="branch_name"
                                required
                                maxLength={120}
                                value={form.data.branch_name}
                                onChange={(event) =>
                                    form.setData(
                                        'branch_name',
                                        event.target.value,
                                    )
                                }
                                error={form.errors.branch_name}
                            />
                            <Button
                                type="submit"
                                className="max-sm:h-11"
                                disabled={form.processing}
                                aria-busy={form.processing}
                            >
                                {form.processing ? (
                                    <Spinner
                                        role="presentation"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {form.processing
                                    ? 'Creating...'
                                    : 'Create organization'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
