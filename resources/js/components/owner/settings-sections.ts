import type { ReadinessItem } from '@/types/owner';

export type SettingsSectionKey =
    | ReadinessItem['tab']
    | 'booking-policy'
    | 'readiness'
    | 'directory';

export type SettingsSection = {
    key: SettingsSectionKey;
    /** Short section name: navigation label and the visible mobile heading. */
    label: string;
    /** Supporting description under the page heading and on the Settings index. */
    description: string;
    /** One-line summary shown on the Settings index. */
    summary: string;
};

/**
 * The seven Owner Settings destinations in their approved order (Decision 207).
 * Billing is a primary Owner destination and is deliberately not listed here.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
    {
        key: 'profile',
        summary: 'Business identity and media',
        label: 'Profile',
        description: 'Manage your public profile and branch information.',
    },
    {
        key: 'hours',
        summary: 'Weekly hours and overrides',
        label: 'Hours',
        description: 'Weekly opening hours and date-specific overrides.',
    },
    {
        key: 'services',
        summary: 'Vehicle types, services and add-ons',
        label: 'Services',
        description:
            'Vehicle types, services, variants, consumption and add-ons.',
    },
    {
        key: 'resources',
        summary: 'Resource types, bays and capacity',
        label: 'Resources',
        description: 'Physical scheduling resource types, bays and capacities.',
    },
    {
        key: 'booking-policy',
        summary: 'Confirmation and scheduling rules',
        label: 'Booking Policy',
        description:
            'Confirmation, scheduling, cancellation and rescheduling rules.',
    },
    {
        key: 'readiness',
        summary: 'Publishing checklist',
        label: 'Readiness',
        description: 'Derived readiness checks and publication controls.',
    },
    {
        key: 'directory',
        summary: 'Customer directory preference',
        label: 'Directory',
        description: 'Neutral Rinquo directory opt-in preference.',
    },
];

export function settingsSection(key: SettingsSectionKey): SettingsSection {
    return (
        SETTINGS_SECTIONS.find((section) => section.key === key) ??
        SETTINGS_SECTIONS[0]
    );
}
