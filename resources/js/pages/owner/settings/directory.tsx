import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import OwnerShell from '@/layouts/owner-shell';

type Organization = { id: number; name: string; baseUrl: string };
export default function Directory({
    organization,
    directoryOptedIn,
}: {
    organization: Organization;
    directoryOptedIn: boolean;
}) {
    const form = useForm({ directory_opted_in: directoryOptedIn });
    return (
        <OwnerShell>
            <Head title="Directory visibility" />
            <Card>
                <CardHeader>
                    <CardTitle>Rinquo directory</CardTitle>
                    <CardDescription>
                        Opt in to let customers discover this shop by business
                        name or city. Your direct shop URL is unaffected.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.put(`${organization.baseUrl}/directory`);
                        }}
                    >
                        <label className="flex items-start gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={form.data.directory_opted_in}
                                onChange={(event) =>
                                    form.setData(
                                        'directory_opted_in',
                                        event.target.checked,
                                    )
                                }
                                className="mt-1 size-4"
                            />{' '}
                            <span>
                                <strong>Show in the Rinquo directory</strong>
                                <br />
                                <span className="text-muted-foreground">
                                    The shop is listed only while it is also
                                    published and ready to accept bookings.
                                </span>
                            </span>
                        </label>
                        <Button className="w-fit" disabled={form.processing}>
                            {form.processing
                                ? 'Saving...'
                                : 'Save directory preference'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </OwnerShell>
    );
}
