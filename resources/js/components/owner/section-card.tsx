import type { ComponentProps, ReactNode } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<typeof Card>, 'title'> & {
    title: string;
    description?: ReactNode;
    /** Status chip shown beside the title (for example Active or Archived). */
    badge?: ReactNode;
    /** Heading level of the title; use h3 when the card sits under an h2 section. */
    headingLevel?: 'h2' | 'h3';
    /** Omit the body wrapper when the card only has a header. */
    children?: ReactNode;
    contentClassName?: string;
};

/**
 * Owner settings section (reference 05): a flat, rounded card with a title, a
 * muted one-line description and an optional status chip. Titles use the
 * section-heading step of the type scale; the description is the quiet tier.
 */
export function SectionCard({
    title,
    description,
    badge,
    headingLevel = 'h2',
    children,
    className,
    contentClassName,
    ...card
}: Props) {
    const Heading = headingLevel;

    return (
        <Card
            className={cn('gap-5 rounded-2xl shadow-none', className)}
            {...card}
        >
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 leading-snug">
                    <Heading className="text-xl font-semibold tracking-tight">
                        {title}
                    </Heading>
                    {badge}
                </CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
            </CardHeader>
            {children ? (
                <CardContent className={contentClassName}>
                    {children}
                </CardContent>
            ) : null}
        </Card>
    );
}
