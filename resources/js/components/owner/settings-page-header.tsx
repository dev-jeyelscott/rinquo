import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeftIcon, CircleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    SETTINGS_SECTIONS,
    settingsSection,
} from '@/components/owner/settings-sections';
import type { SettingsSectionKey } from '@/components/owner/settings-sections';
import { cn } from '@/lib/utils';
import type { OwnerPageProps } from '@/types/owner';

type Props = {
    /** The Settings section this page is; omit on the Settings index. */
    section?: SettingsSectionKey;
    /** Replaces the section's default description. */
    description?: ReactNode;
};

/**
 * Page-owned Owner Settings heading (Decision 209). Desktop reads
 * "Settings · <Section>" under a SETTINGS eyebrow with the underline Settings
 * navigation beneath it; mobile shows the "Settings" back link, the short
 * section name and the description. The page renders exactly one h1 and the
 * document title is always "Settings · <Section>".
 */
export function SettingsPageHeader({ section, description }: Props) {
    const current = section ? settingsSection(section) : null;
    const indexUrl = usePage<OwnerPageProps>().props.organization.baseUrl;

    return (
        <header className="mb-6 grid gap-1 lg:mb-8">
            <Head
                title={current ? `Settings · ${current.label}` : 'Settings'}
            />
            {current ? (
                <Link
                    href={indexUrl}
                    className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none lg:hidden"
                >
                    <ChevronLeftIcon className="size-4" aria-hidden="true" />
                    Settings
                </Link>
            ) : null}
            <p className="hidden text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
                Settings
            </p>
            <h1
                aria-label={current ? `Settings · ${current.label}` : undefined}
                className="text-3xl font-semibold tracking-tight"
            >
                {current ? (
                    <>
                        <span className="max-lg:hidden">Settings · </span>
                        {current.label}
                    </>
                ) : (
                    'Settings'
                )}
            </h1>
            <p className="max-w-[66ch] text-sm text-muted-foreground">
                {description ?? current?.description ?? <IndexDescription />}
            </p>
            <SettingsNav />
        </header>
    );
}

function IndexDescription() {
    return (
        <>
            <span className="max-lg:hidden">
                Manage your shop configuration.
            </span>
            <span className="lg:hidden">
                Choose a section to manage your shop.
            </span>
        </>
    );
}

/** Desktop-only secondary navigation: seven real links, active one underlined. */
function SettingsNav() {
    const { props, url } = usePage<OwnerPageProps>();
    const { organization, readiness } = props;
    const failing = new Set<string>(
        readiness.items.filter((item) => !item.passed).map((item) => item.tab),
    );

    return (
        <nav aria-label="Settings" className="mt-4 hidden border-b lg:block">
            <ul className="-mb-px flex gap-8">
                {SETTINGS_SECTIONS.map((section) => {
                    const href = `${organization.baseUrl}/${section.key}`;
                    const active = url.startsWith(href);

                    return (
                        <li key={section.key}>
                            <Link
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-11 items-center gap-1.5 border-b-2 text-sm font-semibold whitespace-nowrap focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                                    active
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {section.label}
                                {failing.has(section.key) ? (
                                    <CircleAlertIcon
                                        className="size-4 text-warning"
                                        aria-label="Needs attention"
                                    />
                                ) : null}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
