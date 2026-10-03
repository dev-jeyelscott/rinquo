import { Head, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { appName } = usePage().props;

    return (
        <>
            <Head title="Welcome" />
            <section aria-labelledby="shell-heading" className="space-y-2">
                <h1
                    id="shell-heading"
                    className="text-2xl font-semibold tracking-tight"
                >
                    {appName}
                </h1>
                <p className="text-muted-foreground">
                    The application foundation is running.
                </p>
            </section>
        </>
    );
}
