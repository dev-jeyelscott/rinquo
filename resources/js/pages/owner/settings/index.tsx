import { Link } from '@inertiajs/react';
import { ChevronRightIcon } from 'lucide-react';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
import { SETTINGS_SECTIONS } from '@/components/owner/settings-sections';
import type { SettingsSection } from '@/components/owner/settings-sections';
import { StatusChip } from '@/components/owner/status-chip';
import type { OwnerPageProps } from '@/types/owner';

/**
 * Owner Settings index (Decisions 206 and 207): the seven task-oriented
 * destinations and, on mobile, the only way into a section. Readiness text is
 * derived from the server's checklist; nothing here decides eligibility.
 */
export default function SettingsIndex({
    organization,
    readiness,
}: OwnerPageProps) {
    const failing = new Set<string>(
        readiness.items.filter((item) => !item.passed).map((item) => item.tab),
    );

    function status(section: SettingsSection) {
        if (section.key === 'readiness') {
            return readiness.isReady
                ? { label: 'Ready', tone: 'success' as const }
                : { label: 'Not ready', tone: 'warning' as const };
        }

        return failing.has(section.key)
            ? { label: 'Needs attention', tone: 'warning' as const }
            : null;
    }

    return (
        <>
            <SettingsPageHeader />
            <section
                aria-labelledby="owner-settings-heading"
                className="lg:rounded-2xl lg:border lg:bg-card lg:p-6"
            >
                <div className="mb-4 hidden gap-1 lg:grid">
                    <h2
                        id="owner-settings-heading"
                        className="text-xl font-semibold tracking-tight"
                    >
                        Owner Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Choose a configuration area. Each destination is its own
                        page.
                    </p>
                </div>
                <ul className="grid gap-2 lg:grid-cols-2 lg:gap-4">
                    {SETTINGS_SECTIONS.map((section) => {
                        const state = status(section);

                        return (
                            <li key={section.key}>
                                <Link
                                    href={`${organization.baseUrl}/${section.key}`}
                                    className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-2.5 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none lg:gap-4 lg:p-4"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="grid size-10 shrink-0 place-items-center rounded-lg bg-info/10 font-semibold text-primary lg:hidden"
                                    >
                                        {section.label.charAt(0)}
                                    </span>
                                    <span className="grid min-w-0 flex-1 gap-0.5">
                                        <span className="font-semibold">
                                            {section.label}
                                        </span>
                                        <span className="truncate text-sm text-muted-foreground lg:whitespace-normal">
                                            {section.summary}
                                        </span>
                                    </span>
                                    {state ? (
                                        <StatusChip tone={state.tone}>
                                            {state.label}
                                        </StatusChip>
                                    ) : null}
                                    <ChevronRightIcon
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </>
    );
}
