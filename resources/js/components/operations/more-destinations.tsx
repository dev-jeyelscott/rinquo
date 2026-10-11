import { Link } from '@inertiajs/react';
import { ChevronRightIcon } from 'lucide-react';
import { StatusChip } from '@/components/owner/status-chip';
import type { OwnerPageProps } from '@/types/owner';

type Props = Pick<OwnerPageProps, 'organization' | 'viewer'>;

/**
 * The mobile More view (Spec 04 reference 17): secondary destinations as real
 * links. Staff are shown only operational destinations; Billing and Settings
 * appear only when the server says the viewer is an Owner, and the server
 * policy still guards both routes.
 */
export function MoreDestinations({ organization, viewer }: Props) {
    const row =
        'flex min-h-11 items-center justify-between gap-3 border-b py-3 text-sm font-semibold last:border-b-0 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none';

    return (
        <nav
            aria-label="More destinations"
            className="rounded-2xl border bg-card px-5"
        >
            <ul>
                <li>
                    <Link
                        href={organization.bookingRequestsUrl}
                        className={row}
                    >
                        Booking Requests
                        <ChevronRightIcon
                            aria-hidden="true"
                            className="size-4"
                        />
                    </Link>
                </li>
                <li>
                    <Link href={organization.conflictsUrl} className={row}>
                        <span className="flex items-center gap-2">
                            Conflicts
                            {organization.unresolvedConflicts > 0 ? (
                                <StatusChip tone="warning">
                                    {organization.unresolvedConflicts}{' '}
                                    unresolved
                                </StatusChip>
                            ) : null}
                        </span>
                        <ChevronRightIcon
                            aria-hidden="true"
                            className="size-4"
                        />
                    </Link>
                </li>
                {viewer.canManageOwnerAreas ? (
                    <>
                        <li>
                            <Link
                                href={organization.billingUrl}
                                className={row}
                            >
                                <span>
                                    Billing{' '}
                                    <span className="font-normal text-muted-foreground">
                                        · Owner only
                                    </span>
                                </span>
                                <ChevronRightIcon
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </Link>
                        </li>
                        <li>
                            <Link href={organization.baseUrl} className={row}>
                                <span>
                                    Settings{' '}
                                    <span className="font-normal text-muted-foreground">
                                        · Owner only
                                    </span>
                                </span>
                                <ChevronRightIcon
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </Link>
                        </li>
                    </>
                ) : null}
            </ul>
        </nav>
    );
}
