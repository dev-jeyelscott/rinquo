import { Head } from '@inertiajs/react';
import { ShieldCheckIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

/**
 * One centered task card for the signed-out platform screens (Spec 08 01-10): a task icon,
 * a single h1, a quiet purpose line and one dominant action.
 */
export function AuthCard({
    title,
    description,
    icon: Icon = ShieldCheckIcon,
    children,
}: {
    title: string;
    description?: ReactNode;
    icon?: LucideIcon;
    children: ReactNode;
}) {
    return (
        <>
            <Head title={title} />
            <div className="mx-auto w-full max-w-md py-4 sm:py-12">
                <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="gap-3">
                        <span
                            aria-hidden="true"
                            className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"
                        >
                            <Icon className="size-5" />
                        </span>
                        <CardTitle>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {title}
                            </h1>
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
