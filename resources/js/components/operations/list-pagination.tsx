import { Button } from '@/components/ui/button';
import type { PageInfo } from '@/types/operations';

type Props = {
    /** Plural noun for the list, for example "bookings". */
    noun: string;
    info: PageInfo;
    /** Moves to another page; the page keeps the date, view and the other lists' pages. */
    onPage: (page: number) => void;
    disabled?: boolean;
};

/**
 * Honest range and previous/next controls for one bounded list. It renders
 * nothing when the whole result fits one page, so a short list stays quiet,
 * and otherwise says exactly which part of the whole is on screen.
 */
export function ListPagination({
    noun,
    info,
    onPage,
    disabled = false,
}: Props) {
    if (info.lastPage <= 1) {
        return null;
    }

    return (
        <nav
            aria-label={`${noun} pages`}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
            <p className="tabular-nums" aria-live="polite">
                Showing {info.from}–{info.to} of {info.total} {noun}
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    disabled={disabled || info.page <= 1}
                    onClick={() => onPage(info.page - 1)}
                >
                    Previous page
                </Button>
                <span className="tabular-nums">
                    Page {info.page} of {info.lastPage}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:h-11"
                    disabled={disabled || info.page >= info.lastPage}
                    onClick={() => onPage(info.page + 1)}
                >
                    Next page
                </Button>
            </div>
        </nav>
    );
}
