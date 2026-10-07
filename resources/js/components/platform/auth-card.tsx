import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

/** One centered task card for the signed-out platform screens: a single h1 and one dominant action. */
export function AuthCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <Head title={title} />
            <div className="mx-auto w-full max-w-md py-6">
                <Card className="rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle>
                            <h1 className="text-2xl">{title}</h1>
                        </CardTitle>
                        {description ? (
                            <CardDescription>{description}</CardDescription>
                        ) : null}
                    </CardHeader>
                    <CardContent>{children}</CardContent>
                </Card>
            </div>
        </>
    );
}
