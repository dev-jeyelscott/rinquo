import { XIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    /** Heading level of the title; use h3 when the panel sits under an h2. */
    headingLevel?: 'h2' | 'h3';
};

/**
 * The editing region that opens beneath a list or table when a row's Edit or
 * Add action is used. Opening it, or switching its subject, moves focus to its
 * heading (a named region the keyboard and screen-reader user lands in); closing
 * it returns focus to the control that opened it when that control still exists.
 * The panel only presents: every save still goes through the server policy.
 */
export function EditorPanel({
    title,
    onClose,
    children,
    className,
    headingLevel = 'h2',
}: Props) {
    const Heading = headingLevel;
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const opener = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const active = document.activeElement;
        opener.current =
            active instanceof HTMLElement && active !== document.body
                ? active
                : null;

        return () => {
            if (opener.current?.isConnected) {
                opener.current.focus();
            }
        };
    }, []);

    useEffect(() => {
        heading.current?.focus();
    }, [title]);

    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'grid gap-5 rounded-2xl border bg-card p-5 text-card-foreground',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <Heading
                    id={headingId}
                    ref={heading}
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                >
                    {title}
                </Heading>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    onClick={onClose}
                >
                    <XIcon aria-hidden="true" />
                    Close
                </Button>
            </div>
            {children}
        </section>
    );
}
