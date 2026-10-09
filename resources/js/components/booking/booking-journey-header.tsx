import { Link } from '@inertiajs/react';
import { SparklesIcon } from 'lucide-react';
import { BOOKING_STEPS, StepIndicator } from './step-indicator';

type Props = {
    shopName: string;
    shopUrl: string;
    /** The visible page heading: "Book an appointment", "Customer details", ... */
    title: string;
    subtitle?: string;
    /** The breadcrumb's current page and the eyebrow above the heading. */
    crumb?: string;
    eyebrow?: string;
    /** The wizard stage; omit on pages outside the five-stage journey (results). */
    step?: string;
};

/**
 * The shared header of the customer booking journey (Spec 02 references): a
 * breadcrumb back to the shop, an eyebrow, the page heading with its subtitle
 * and, inside the journey, the five-stage progress in a bordered card. The
 * shop name and brand come from the tenant shell above; everything here is
 * token styled so it follows the tenant's contrast handling.
 */
export function BookingJourneyHeader({
    shopName,
    shopUrl,
    title,
    subtitle = `${shopName} · Fast, easy and secure booking`,
    crumb = 'Book appointment',
    eyebrow = crumb,
    step,
}: Props) {
    return (
        <header className="grid gap-4">
            <div className="grid gap-2">
                <nav aria-label="Breadcrumb">
                    <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
                        <li>
                            <Link
                                href={shopUrl}
                                className="text-primary underline-offset-4 hover:underline"
                            >
                                {shopName}
                            </Link>
                        </li>
                        <li
                            aria-hidden="true"
                            className="text-muted-foreground"
                        >
                            /
                        </li>
                        <li
                            aria-current="page"
                            className="text-muted-foreground"
                        >
                            {crumb}
                        </li>
                    </ol>
                </nav>
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                    <div className="grid gap-1">
                        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                            {eyebrow}
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
                            {title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                    <p className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
                        <SparklesIcon aria-hidden="true" className="size-4" />
                        Easy booking, no payment online
                    </p>
                </div>
            </div>
            {step ? (
                <div className="rounded-2xl border bg-card px-4 py-3 sm:px-8">
                    <StepIndicator steps={BOOKING_STEPS} current={step} />
                </div>
            ) : null}
        </header>
    );
}
